import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"

const SECTION_ROOT = "sections"

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
}

const MAX_BYTES = 2 * 1024 * 1024

export function sectionFileFolder(sectionId: string) {
  return `${SECTION_ROOT}/${sectionId}`
}

function extensionFor(mimeType: string) {
  const ext = EXTENSIONS[mimeType]
  if (!ext) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Yalnızca JPG, PNG, WebP, GIF, AVIF veya SVG yüklenebilir."
    )
  }
  return ext
}

function sanitizeBaseName(filename: string) {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)

  return base || "ikon"
}

export async function uploadSectionFile(
  container: MedusaContainer,
  sectionId: string,
  input: { filename: string; mimeType: string; content: string }
): Promise<{ url: string; key: string }> {
  const mimeType = input.mimeType.trim().toLowerCase()
  const ext = extensionFor(mimeType)

  let bytes: Buffer
  try {
    bytes = Buffer.from(input.content, "base64")
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Dosya okunamadı.")
  }

  if (!bytes.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Dosya boş.")
  }

  if (bytes.length > MAX_BYTES) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Dosya en fazla 2 MB olabilir."
    )
  }

  const filename = `${sectionFileFolder(sectionId)}/${Date.now()}-${sanitizeBaseName(input.filename)}.${ext}`

  const { result } = await uploadFilesWorkflow(container).run({
    input: {
      files: [
        {
          filename,
          mimeType,
          content: bytes.toString("base64"),
          access: "public" as const,
        },
      ],
    },
  })

  const file = result[0]
  if (!file?.url) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Dosya kaydedilemedi."
    )
  }

  return { url: file.url, key: file.id }
}
