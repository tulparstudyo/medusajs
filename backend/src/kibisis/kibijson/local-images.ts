import { createHash } from "crypto"
import fs from "fs/promises"
import path from "path"

import type { ImageSet } from "../kibiimport/catalog"
import { ImportException } from "../kibiimport/errors"
import { DownloadedImage, downloadImages } from "../kibiimport/images"
import { RetryableException } from "./errors"

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024
/** A file changed this recently may still be uploading over FTP. */
export const STABLE_MS = 30_000
export const PROCESSED_FOLDER = "_processed"

export type ImageSource = { kind: "local"; path: string } | { kind: "remote"; url: string }

export type LocalImageCheck =
  | { ok: true; size: number; mediaType: string; busy: boolean }
  | { ok: false; message: string }

export function imageRoot(): string {
  return path.resolve(process.env.KIBIIMPORT_IMAGE_ROOT || path.join(process.cwd(), "import-images"))
}

/** IsSafeRelativePath accepts "folder/file.jpg" and refuses anything that could leave the root. */
export function isSafeRelativePath(value: string): boolean {
  if (!value || value.length > 500 || value.includes("\0") || value.includes("\\")) {
    return false
  }

  if (value.startsWith("/") || /^[a-zA-Z]:/.test(value) || value.includes("://")) {
    return false
  }

  return value.split("/").every((part) => part !== ".." && part !== "." && part !== "")
}

/** ImageSourceOf reads an images entry: an http(s) link downloads, anything else is a file under the root. */
export function imageSourceOf(value: string): ImageSource {
  return /^https?:\/\//i.test(value) ? { kind: "remote", url: value } : { kind: "local", path: value }
}

/**
 * ResolveLocalPath joins root, batch folder and entry and follows links, so
 * the real file must still sit inside the root.
 */
export async function resolveLocalPath(base: string | null, entry: string): Promise<string> {
  if (!isSafeRelativePath(entry) || (base && !isSafeRelativePath(base))) {
    throw new ImportException(`Görsel yolu geçersiz: ${entry}`)
  }

  const root = imageRoot()
  const target = path.resolve(root, ...(base ? base.split("/") : []), ...entry.split("/"))
  let realRoot: string
  let realTarget: string

  try {
    realRoot = await fs.realpath(root)
  } catch {
    throw new ImportException(`Görsel klasörü bulunamadı: ${root}`)
  }

  try {
    realTarget = await fs.realpath(target)
  } catch {
    throw new ImportException(`Görsel bulunamadı: ${joinShown(base, entry)}`)
  }

  if (!realTarget.startsWith(realRoot + path.sep)) {
    throw new ImportException(`Görsel klasör dışında: ${joinShown(base, entry)}`)
  }

  return realTarget
}

/** SniffImage names the image type from the first bytes and ignores the file extension. */
export function sniffImage(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }

  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png"
  }

  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("latin1"))) {
    return "image/gif"
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp"
  }

  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = bytes.subarray(8, 12).toString("latin1")
    return brand === "avif" || brand === "avis" ? "image/avif" : null
  }

  return null
}

/** CheckLocalImage looks at a file without reading it whole; used before a batch starts. */
export async function checkLocalImage(
  base: string | null,
  entry: string,
  now: number = Date.now()
): Promise<LocalImageCheck> {
  let file: string

  try {
    file = await resolveLocalPath(base, entry)
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }

  const stats = await fs.stat(file)

  if (!stats.isFile()) {
    return { ok: false, message: `Görsel bir dosya değil: ${joinShown(base, entry)}` }
  }

  if (stats.size === 0 || stats.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: `Görsel boş veya ${MAX_IMAGE_BYTES / 1024 / 1024} MB'tan büyük: ${joinShown(base, entry)}` }
  }

  const handle = await fs.open(file, "r")

  try {
    const head = Buffer.alloc(16)
    await handle.read(head, 0, 16, 0)
    const mediaType = sniffImage(head)

    if (!mediaType) {
      return { ok: false, message: `Desteklenmeyen görsel türü: ${joinShown(base, entry)}` }
    }

    return { ok: true, size: stats.size, mediaType, busy: now - stats.mtimeMs < STABLE_MS }
  } finally {
    await handle.close()
  }
}

export async function readLocalImage(
  base: string | null,
  entry: string,
  now: number = Date.now()
): Promise<DownloadedImage & { sha256: string }> {
  const file = await resolveLocalPath(base, entry)
  const stats = await fs.stat(file)

  if (!stats.isFile()) {
    throw new ImportException(`Görsel bir dosya değil: ${joinShown(base, entry)}`)
  }

  if (now - stats.mtimeMs < STABLE_MS) {
    throw new RetryableException(`Görsel hâlâ yükleniyor olabilir: ${joinShown(base, entry)}`)
  }

  if (stats.size === 0 || stats.size > MAX_IMAGE_BYTES) {
    throw new ImportException(
      `Görsel boş veya ${MAX_IMAGE_BYTES / 1024 / 1024} MB'tan büyük: ${joinShown(base, entry)}`
    )
  }

  const bytes = await fs.readFile(file)
  const mediaType = sniffImage(bytes)

  if (!mediaType) {
    throw new ImportException(`Desteklenmeyen görsel türü: ${joinShown(base, entry)}`)
  }

  return { bytes, mediaType, sha256: createHash("sha256").update(bytes).digest("hex") }
}

/**
 * BuildImageSet reads local files now so their content hash can name them:
 * a renamed batch folder keeps the stored images, a replaced file does not.
 * Links keep their address as the name and download only when needed.
 */
export async function buildImageSet(entries: string[], base: string | null): Promise<ImageSet> {
  const loaded: (DownloadedImage | string)[] = []
  const sources: string[] = []

  for (const entry of entries) {
    const source = imageSourceOf(entry)

    if (source.kind === "remote") {
      loaded.push(source.url)
      sources.push(source.url)
      continue
    }

    const image = await readLocalImage(base, source.path)
    loaded.push({ bytes: image.bytes, mediaType: image.mediaType })
    sources.push(`sha256:${image.sha256}`)
  }

  return {
    sources,
    load: async () => {
      const images: DownloadedImage[] = []

      for (const item of loaded) {
        images.push(typeof item === "string" ? (await downloadImages([item]))[0] : item)
      }

      return images
    },
  }
}

/** ReadDocumentFile reads a JSON document uploaded next to the images. */
export async function readDocumentFile(entry: string): Promise<unknown> {
  const file = await resolveLocalPath(null, entry)
  const stats = await fs.stat(file)

  if (!stats.isFile() || stats.size > MAX_DOCUMENT_BYTES) {
    throw new ImportException(`JSON dosyası okunamadı veya çok büyük: ${entry}`)
  }

  try {
    return JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""))
  } catch {
    throw new ImportException(`JSON dosyası geçerli değil: ${entry}`)
  }
}

/** ArchiveFolder moves a finished batch folder to `_processed/<folder>-<time>`. */
export async function archiveFolder(base: string): Promise<string | null> {
  if (!isSafeRelativePath(base) || base.split("/")[0] === PROCESSED_FOLDER) {
    return null
  }

  const root = imageRoot()
  const source = path.resolve(root, ...base.split("/"))

  try {
    if (!(await fs.stat(source)).isDirectory()) {
      return null
    }
  } catch {
    return null
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const target = path.join(root, PROCESSED_FOLDER, `${base.split("/").join("__")}-${stamp}`)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.rename(source, target)

  return path.relative(root, target).split(path.sep).join("/")
}

/** PruneProcessed deletes archived batch folders older than the given age. */
export async function pruneProcessed(maxAgeMs: number, now: number = Date.now()): Promise<number> {
  const folder = path.join(imageRoot(), PROCESSED_FOLDER)
  let removed = 0
  let entries: import("fs").Dirent[]

  try {
    entries = await fs.readdir(folder, { withFileTypes: true })
  } catch {
    return 0
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const full = path.join(folder, entry.name)

    if (now - (await fs.stat(full)).mtimeMs > maxAgeMs) {
      await fs.rm(full, { recursive: true, force: true })
      removed += 1
    }
  }

  return removed
}

function joinShown(base: string | null, entry: string): string {
  return base ? `${base}/${entry}` : entry
}
