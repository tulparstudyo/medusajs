import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteFilesWorkflow, uploadFilesWorkflow } from "@medusajs/medusa/core-flows"

import { stripCdnUrl } from "../cdn/url"
import { HttpStatusException, ImportException } from "./errors"
import { slugify } from "./lib/slug"
import { remoteGet } from "./remote-get"

export const IMAGE_ROOT = "products"

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
}

export type DownloadedImage = {
  bytes: Buffer
  mediaType: string
}

export type UploadedImages = {
  urls: string[]
  keys: string[]
}

/**
 * StoredImages is what an import remembers in the product metadata: the source
 * image links it read and the file keys it wrote for them.
 */
export type StoredImages = {
  sources: string[]
  keys: string[]
}

/** ImageFolder groups uploads by month, e.g. "products/2026-10". */
export function imageFolder(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${IMAGE_ROOT}/${date.getFullYear()}-${month}`
}

export function imageFilename(folder: string, code: string, index: number, mediaType: string): string {
  return `${folder}/${slugify(code)}-${index + 1}.${extension(mediaType)}`
}

export function storedImagesOf(metadata: Record<string, unknown> | null | undefined): StoredImages | null {
  const record = metadata?.kibiimport

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null
  }

  const sources = (record as Record<string, unknown>).image_sources
  const keys = (record as Record<string, unknown>).image_keys

  if (!isStringArray(sources) || !isStringArray(keys)) {
    return null
  }

  return { sources, keys }
}

export function sameSources(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export async function downloadImages(urls: string[]): Promise<DownloadedImage[]> {
  const images: DownloadedImage[] = []

  for (const url of urls) {
    const response = await remoteGet(url, "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")

    if (response.status < 200 || response.status >= 300) {
      throw new HttpStatusException(
        response.status,
        `Ürün görseli için HTTP ${response.status} döndü: ${url}`
      )
    }

    if (!response.mediaType.startsWith("image/")) {
      throw new ImportException(`Ürün görseli indirilemedi: ${url}`)
    }

    images.push({ bytes: response.body, mediaType: response.mediaType })
  }

  return images
}

export async function uploadImages(
  container: MedusaContainer,
  code: string,
  images: DownloadedImage[]
): Promise<UploadedImages> {
  if (!images.length) {
    return { urls: [], keys: [] }
  }

  const folder = imageFolder()
  const { result } = await uploadFilesWorkflow(container).run({
    input: {
      files: images.map((image, index) => ({
        filename: imageFilename(folder, code, index, image.mediaType),
        mimeType: image.mediaType,
        content: image.bytes.toString("base64"),
        access: "public" as const,
      })),
    },
  })

  return {
    urls: result.map((file) => stripCdnUrl(file.url)),
    keys: result.map((file) => file.id),
  }
}

/**
 * DeleteImages never fails the import: the product is already saved, so a
 * file that cannot be removed is only logged and left for the cleanup script.
 */
export async function deleteImages(container: MedusaContainer, keys: string[]): Promise<void> {
  if (!keys.length) {
    return
  }

  try {
    await deleteFilesWorkflow(container).run({ input: { ids: keys } })
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`kibiimport: görseller silinemedi (${keys.join(", ")}): ${(error as Error).message}`)
  }
}

function extension(mediaType: string): string {
  return EXTENSIONS[mediaType] ?? "jpg"
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}
