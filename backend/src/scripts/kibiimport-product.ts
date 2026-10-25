import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"

import { importProduct, readProduct, renderPreview, renderResult } from "../kibisis/kibiimport/importer"

/**
 * Import one product link. Medusa passes words after the file path as args.
 *
 *   npx medusa exec ./src/scripts/kibiimport-product.ts https://www.trendyol.com/... pcat_... dry-run
 */
export default async function kibiimportProduct({ container, args }: ExecArgs) {
  const dryRun = args.includes("--dry-run") || args.includes("dry-run")
  const url =
    flag(args, "--url") ??
    args.find((arg) => arg.startsWith("http://") || arg.startsWith("https://")) ??
    null
  const categoryId =
    flag(args, "--category") ??
    args.find(
      (arg) =>
        arg !== url &&
        arg !== "dry-run" &&
        arg !== "--dry-run" &&
        !arg.startsWith("--")
    ) ??
    null

  if (!url) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Ürün linkini dosya yolundan sonra yazın.")
  }

  if (dryRun) {
    const product = await readProduct(url)
    process.stdout.write(`${renderPreview(product)}\nKayıt yazılmadı.\n`)
    return
  }

  if (!categoryId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Kategori kimliğini linkten sonra yazın.")
  }

  const result = await importProduct(container, url, categoryId)
  process.stdout.write(`${renderResult(result)}\n`)
}

function flag(args: string[], name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`${name}=`))

  if (inline) {
    return inline.slice(name.length + 1)
  }

  const index = args.indexOf(name)
  const value = index >= 0 ? args[index + 1] : undefined

  if (!value || value.startsWith("--")) {
    return null
  }

  return value
}
