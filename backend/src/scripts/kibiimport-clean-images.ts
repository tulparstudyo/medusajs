import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"

import { cleanImages } from "../kibisis/kibiimport/cleanup"

const DEFAULT_DAYS = 7
const LISTED = 50

/**
 * Report, or with --apply delete, kibiimport images that no product, page
 * section, setting or menu item points to. Without apply nothing is removed.
 * Medusa's CLI rejects unknown --flags, so the words are passed without dashes.
 *
 *   npx medusa exec ./src/scripts/kibiimport-clean-images.ts
 *   npx medusa exec ./src/scripts/kibiimport-clean-images.ts days=30
 *   npx medusa exec ./src/scripts/kibiimport-clean-images.ts apply
 */
export default async function kibiimportCleanImages({ container, args }: ExecArgs) {
  const apply = args.includes("apply")
  const daysArg = args.find((arg) => arg.startsWith("days="))
  const minAgeDays = daysArg ? Number(daysArg.slice("days=".length)) : DEFAULT_DAYS

  if (!Number.isFinite(minAgeDays) || minAgeDays < 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "days sıfır veya pozitif bir sayı olmalı.")
  }

  const report = await cleanImages(container, { apply, minAgeDays })
  const bytes = report.orphans.reduce((sum, file) => sum + file.size, 0)
  const lines = [
    `Klasör: ${report.root}`,
    `İncelenen içe aktarma görseli: ${report.scanned}`,
    `Kullanımda: ${report.referenced}`,
    `${minAgeDays} günden yeni olduğu için atlanan: ${report.recent}`,
    `Kullanılmayan: ${report.orphans.length} (${megabytes(bytes)} MB)`,
    ...report.orphans.slice(0, LISTED).map((file) => `  ${file.key}`),
    ...(report.orphans.length > LISTED ? [`  ... ve ${report.orphans.length - LISTED} dosya daha`] : []),
    apply
      ? `Silinen: ${report.deleted}`
      : "Hiçbir dosya silinmedi. Silmek için komutun sonuna apply ekleyin.",
  ]

  process.stdout.write(`${lines.join("\n")}\n`)
}

function megabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1)
}
