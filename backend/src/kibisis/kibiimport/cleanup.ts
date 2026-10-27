import fs from "fs/promises"
import path from "path"

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { deleteFilesWorkflow } from "@medusajs/medusa/core-flows"

import { KIBINAV_MODULE } from "../kibinav"
import { KIBIPAGE_MODULE } from "../kibipage"
import { KIBISETTINGS_MODULE } from "../kibisettings"
import { IMAGE_ROOT } from "./images"
import { KIBIIMPORT_MODULE } from "./index"
import { slugify } from "./lib/slug"
import KibiimportModuleService from "./service"

const PAGE_SIZE = 200
const DELETE_BATCH = 100
const DAY_MS = 24 * 60 * 60 * 1000
const IMAGE_PATH = /[\w.%~/-]+\.(?:avif|gif|jpe?g|png|webp)/gi
const LEGACY_NAME = /^\d+-(.+)-\d+\.(?:avif|gif|jpe?g|png|webp)$/i

export type StoredFile = {
  key: string
  size: number
  modifiedAt: Date
}

export type CleanupOptions = {
  apply: boolean
  minAgeDays: number
  now?: Date
}

export type CleanupReport = {
  root: string
  scanned: number
  referenced: number
  recent: number
  orphans: StoredFile[]
  deleted: number
}

type Listable = (
  filters: Record<string, unknown>,
  config: { take: number; skip: number }
) => Promise<unknown[]>

/**
 * CleanImages finds image files written by kibiimport that no record points
 * to any more and, with apply, deletes them through the file module. Files
 * younger than minAgeDays are kept so an import that is still running never
 * loses the images it has just uploaded.
 */
export async function cleanImages(
  container: MedusaContainer,
  options: CleanupOptions
): Promise<CleanupReport> {
  const root = process.env.CDN_DIR

  if (!root) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "CDN_DIR tanımlı değil.")
  }

  const service = container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService
  const codes = await importedCodes(service)
  const files = [
    ...(await listFiles(root, path.join(root, IMAGE_ROOT))),
    ...(await legacyFiles(root, new Set(codes.map(slugify)))),
  ]
  const references = referencedPaths(await referenceTexts(container))
  const selection = selectOrphans(
    files,
    references,
    options.minAgeDays * DAY_MS,
    options.now ?? new Date()
  )
  let deleted = 0

  if (options.apply && selection.orphans.length) {
    for (let start = 0; start < selection.orphans.length; start += DELETE_BATCH) {
      const ids = selection.orphans.slice(start, start + DELETE_BATCH).map((file) => file.key)
      await deleteFilesWorkflow(container).run({ input: { ids } })
      deleted += ids.length
    }

    await removeEmptyFolders(path.join(root, IMAGE_ROOT))
  }

  return {
    root,
    scanned: files.length,
    referenced: selection.referenced,
    recent: selection.recent,
    orphans: selection.orphans,
    deleted,
  }
}

/**
 * ReferencedPaths collects every image path found in the given texts, with
 * each trailing part after a slash, so "http://cdn/products/2026-10/a.webp"
 * matches both the key "products/2026-10/a.webp" and a flat "a.webp".
 */
export function referencedPaths(texts: string[]): Set<string> {
  const paths = new Set<string>()

  for (const text of texts) {
    for (const match of text.matchAll(IMAGE_PATH)) {
      const value = safeDecode(match[0])
      paths.add(value)

      for (let index = value.indexOf("/"); index >= 0; index = value.indexOf("/", index + 1)) {
        paths.add(value.slice(index + 1))
      }
    }
  }

  return paths
}

export function selectOrphans(
  files: StoredFile[],
  references: Set<string>,
  minAgeMs: number,
  now: Date
): { orphans: StoredFile[]; referenced: number; recent: number } {
  const orphans: StoredFile[] = []
  let referenced = 0
  let recent = 0

  for (const file of files) {
    if (references.has(file.key)) {
      referenced += 1
    } else if (now.getTime() - file.modifiedAt.getTime() < minAgeMs) {
      recent += 1
    } else {
      orphans.push(file)
    }
  }

  return { orphans, referenced, recent }
}

/** IsLegacyImportFile matches flat "<time>-<code slug>-<n>.<ext>" uploads made before the folders. */
export function isLegacyImportFile(name: string, slugs: Set<string>): boolean {
  const match = LEGACY_NAME.exec(name)
  return match !== null && slugs.has(match[1])
}

async function importedCodes(service: KibiimportModuleService): Promise<string[]> {
  const rows = await listAll((filters, config) => service.listImportProducts(filters, config))
  return [...new Set(rows.map((row) => (row as { code: string }).code))]
}

async function referenceTexts(container: MedusaContainer): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const products = await listAll(async (_filters, config) => {
    const { data } = await query.graph({
      entity: "product",
      fields: ["thumbnail", "images.url"],
      pagination: config,
    })
    return data
  })
  const sections = await listAll(moduleLister(container, KIBIPAGE_MODULE, "listPageSections"))
  const settings = await listAll(moduleLister(container, KIBISETTINGS_MODULE, "listSettingsRecords"))
  const navItems = await listAll(moduleLister(container, KIBINAV_MODULE, "listKibinavItems"))

  return [...products, ...sections, ...settings, ...navItems].map((row) => JSON.stringify(row))
}

function moduleLister(container: MedusaContainer, module: string, method: string): Listable {
  const service = container.resolve(module) as Record<string, Listable>
  return (filters, config) => service[method](filters, config)
}

async function listAll(list: Listable): Promise<unknown[]> {
  const rows: unknown[] = []

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await list({}, { take: PAGE_SIZE, skip })
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      return rows
    }
  }
}

async function listFiles(root: string, folder: string): Promise<StoredFile[]> {
  const entries = await readFolder(folder)
  const files: StoredFile[] = []

  for (const entry of entries) {
    const full = path.join(folder, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, full)))
    } else if (entry.isFile()) {
      files.push(await storedFile(root, full))
    }
  }

  return files
}

async function legacyFiles(root: string, slugs: Set<string>): Promise<StoredFile[]> {
  const entries = await readFolder(root)
  const files: StoredFile[] = []

  for (const entry of entries) {
    if (entry.isFile() && isLegacyImportFile(entry.name, slugs)) {
      files.push(await storedFile(root, path.join(root, entry.name)))
    }
  }

  return files
}

async function storedFile(root: string, full: string): Promise<StoredFile> {
  const stats = await fs.stat(full)

  return {
    key: path.relative(root, full).split(path.sep).join("/"),
    size: stats.size,
    modifiedAt: stats.mtime,
  }
}

async function readFolder(folder: string) {
  try {
    return await fs.readdir(folder, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }

    throw error
  }
}

/** RemoveEmptyFolders drops month folders left empty, keeping the root itself. */
async function removeEmptyFolders(folder: string): Promise<void> {
  for (const entry of await readFolder(folder)) {
    if (!entry.isDirectory()) {
      continue
    }

    const child = path.join(folder, entry.name)
    await removeEmptyFolders(child)

    if (!(await readFolder(child)).length) {
      await fs.rmdir(child)
    }
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
