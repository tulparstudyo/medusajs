import fs from "fs/promises"
import path from "path"

import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"

import { createBatch, getBatchDetail, startBatch } from "../kibisis/kibijson/actions"
import { runQueue } from "../kibisis/kibijson/runner"
import { BatchDTO } from "../kibisis/kibijson/types"

const POLL_MS = 5000

/**
 * Check a kibiimport.product/v1 file and, with --start, import it right away.
 * Without --start the batch waits in the admin under "Kibitools > JSON Ürün Aktar".
 *
 *   npx medusa exec ./src/scripts/kibijson-import.ts ./products.json
 *   npx medusa exec ./src/scripts/kibijson-import.ts ./products.json --start --currency=try --locations=sloc_1
 *   npx medusa exec ./src/scripts/kibijson-import.ts ./products.json --start --category=pcat_... --image-base=eski-site-2026-10-28
 */
export default async function kibijsonImport({ container, args }: ExecArgs) {
  const file = args.find((arg) => !arg.startsWith("--"))

  if (!file) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "JSON dosyasının yolunu yazın.")
  }

  const document = JSON.parse((await fs.readFile(path.resolve(file), "utf8")).replace(/^\uFEFF/, ""))
  const imageBase = flag(args, "--image-base")
  const created = await createBatch(container, {
    document,
    name: flag(args, "--name") ?? path.basename(file),
    ...(imageBase !== null ? { image_base: imageBase } : {}),
  })

  write(`Parti ${created.id}: ${created.pending} ürün hazır, ${created.skipped} ürün atlandı.`)

  for (const line of created.report?.lines ?? []) {
    write(`  ${line.level === "error" ? "HATA" : "uyarı"} #${line.position} ${line.code} / ${line.color}: ${line.message}`)
  }

  if (!args.includes("--start")) {
    write("Başlatmak için admin > Kibitools > JSON Ürün Aktar ekranını kullanın veya --start ekleyin.")
    return
  }

  await startBatch(container, created.id, {
    category_id: flag(args, "--category"),
    currency_code: flag(args, "--currency"),
    location_ids: (flag(args, "--locations") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    options: { skip_unchanged: !args.includes("--force") },
  })

  let batch: BatchDTO

  while (true) {
    await runQueue(container, Number.POSITIVE_INFINITY)
    batch = (await getBatchDetail(container, created.id, { offset: 0, limit: 1 })).batch

    if (!["queued", "running"].includes(batch.status)) {
      break
    }

    write(`${batch.completed + batch.failed + batch.skipped}/${batch.total} işlendi; tekrar denenecekler bekleniyor.`)
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }

  const { items } = await getBatchDetail(container, created.id, { offset: 0, limit: 200 })

  for (const item of items) {
    const detail = item.error ?? item.warnings.join(" · ")
    write(`#${item.position} ${item.code} / ${item.color}: ${item.status}${item.product_id ? ` (${item.product_id})` : ""}${detail ? ` — ${detail}` : ""}`)
  }

  write(`Bitti: ${batch.completed} başarılı, ${batch.failed} hatalı, ${batch.skipped} atlandı.`)
}

function write(line: string): void {
  process.stdout.write(`${line}\n`)
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
