import os from "os"

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { KIBIGROUP_MODULE } from "../kibigroup"
import KibigroupModuleService from "../kibigroup/service"
import { KIBIIMPORT_MODULE } from "../kibiimport"
import { writeProduct } from "../kibiimport/catalog"
import { ImportException } from "../kibiimport/errors"
import { assertProduct } from "../kibiimport/importer"
import KibiimportModuleService from "../kibiimport/service"
import { adaptProduct } from "./adapter"
import { isRetryable, messageOf } from "./errors"
import { sha256 } from "./hash"
import { KIBIJSON_MODULE } from "./index"
import { archiveFolder, buildImageSet } from "./local-images"
import { issueLines, ProductDocumentSchema } from "./schema"
import KibijsonModuleService, { BatchRow, clip, ItemRow, optionsOf, stringsOf } from "./service"
import {
  loadCategoryIndex,
  resolveCategories,
  resolveCollection,
  resolveTags,
  resolveType,
} from "./taxonomy"
import { writeTranslations } from "./translations"
import { ItemResult } from "./types"

const LEASE_MS = 5 * 60 * 1000
const HEARTBEAT_MS = 60 * 1000
const BUDGET_MS = 50 * 1000
const BACKOFF_MS = [30_000, 120_000, 600_000]

type Database = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

type Outcome =
  | { kind: "completed"; productId: string; created: boolean; result: ItemResult; warnings: string[]; fingerprint: string }
  | { kind: "skipped"; productId: string; reason: string; fingerprint: string }

const WORKER = `${os.hostname()}:${process.pid}`
let current: Promise<number> | null = null

/**
 * RunQueue imports pending items one at a time until none is due or the
 * time budget is spent. A call while a run is going waits for that run;
 * other processes skip the rows this one holds.
 */
export async function runQueue(container: MedusaContainer, budgetMs: number = BUDGET_MS): Promise<number> {
  if (current) {
    return await current
  }

  current = drain(container, budgetMs)

  try {
    return await current
  } finally {
    current = null
  }
}

async function drain(container: MedusaContainer, budgetMs: number): Promise<number> {
  const db = database(container)
  const touched = new Set(await recoverStale(db))
  const started = Date.now()
  let count = 0

  while (Date.now() - started < budgetMs) {
    const item = await claim(db)

    if (!item) {
      break
    }

    touched.add(item.batch_id)
    await processItem(container, item)
    await refreshBatch(container, item.batch_id)
    count += 1
  }

  for (const batchId of await activeBatchIds(db)) {
    touched.add(batchId)
  }

  for (const batchId of touched) {
    await refreshBatch(container, batchId)
  }

  return count
}

/** Kick starts the runner without waiting; the scheduled job picks up anything it misses. */
export function kick(container: MedusaContainer): void {
  void runQueue(container).catch((error) => {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`kibijson: kuyruk çalışamadı: ${messageOf(error)}`)
  })
}

async function claim(db: Database): Promise<ItemRow | null> {
  const { rows } = await db.raw(
    `UPDATE kibijson_item
     SET status = 'processing', attempts = attempts + 1, locked_until = ?, locked_by = ?,
         started_at = now(), finished_at = NULL, updated_at = now()
     WHERE id = (
       SELECT i.id FROM kibijson_item i
       JOIN kibijson_batch b ON b.id = i.batch_id AND b.deleted_at IS NULL
       WHERE i.deleted_at IS NULL
         AND i.status = 'pending'
         AND i.next_run_at IS NOT NULL
         AND i.next_run_at <= now()
         AND b.status IN ('queued', 'running')
         AND NOT EXISTS (
           SELECT 1 FROM kibijson_item p
           WHERE p.deleted_at IS NULL AND p.status = 'processing' AND p.code = i.code AND p.color = i.color
         )
       ORDER BY b.created_at ASC, i.position ASC
       LIMIT 1
       FOR UPDATE OF i SKIP LOCKED
     )
     RETURNING *`,
    [new Date(Date.now() + LEASE_MS), WORKER]
  )
  const row = rows[0] as ItemRow | undefined

  if (!row) {
    return null
  }

  await db.raw(
    `UPDATE kibijson_batch SET status = 'running', started_at = COALESCE(started_at, now()), updated_at = now()
     WHERE id = ? AND status = 'queued'`,
    [row.batch_id]
  )

  return row
}

/** RecoverStale puts back items whose runner stopped, or fails them when no attempt is left. */
async function recoverStale(db: Database): Promise<string[]> {
  const { rows } = await db.raw(
    `UPDATE kibijson_item
     SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
         error = 'İçe aktarma yarıda kaldı.',
         next_run_at = now(), locked_until = NULL, locked_by = NULL,
         finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END,
         updated_at = now()
     WHERE deleted_at IS NULL AND status = 'processing' AND locked_until < now()
     RETURNING batch_id`
  )

  return [...new Set(rows.map((row) => String(row.batch_id)))]
}

async function activeBatchIds(db: Database): Promise<string[]> {
  const { rows } = await db.raw(
    `SELECT id FROM kibijson_batch WHERE deleted_at IS NULL AND status IN ('queued', 'running')`
  )
  return rows.map((row) => String(row.id))
}

async function processItem(container: MedusaContainer, item: ItemRow): Promise<void> {
  const db = database(container)
  const service = container.resolve(KIBIJSON_MODULE) as KibijsonModuleService
  const heartbeat = setInterval(() => {
    void db
      .raw(`UPDATE kibijson_item SET locked_until = ? WHERE id = ? AND status = 'processing'`, [
        new Date(Date.now() + LEASE_MS),
        item.id,
      ])
      .catch(() => undefined)
  }, HEARTBEAT_MS)

  try {
    const batch = await service.requireBatch(item.batch_id)
    const outcome = await importItem(container, batch, item)

    await service.updateItems({
      id: item.id,
      status: outcome.kind,
      product_id: outcome.productId,
      fingerprint: outcome.fingerprint,
      created: outcome.kind === "completed" ? outcome.created : false,
      result: outcome.kind === "completed" ? (outcome.result as unknown as Record<string, unknown>) : null,
      warnings: (outcome.kind === "completed"
        ? outcome.warnings
        : [outcome.reason]) as unknown as Record<string, unknown>,
      error: null,
      locked_until: null,
      locked_by: null,
      next_run_at: null,
      finished_at: new Date(),
    })
  } catch (error) {
    const attempts = item.attempts ?? 1
    const retry = isRetryable(error) && attempts < (item.max_attempts ?? 1)
    const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[0]

    await service.updateItems({
      id: item.id,
      status: retry ? "pending" : "failed",
      error: clip(retry ? `${messageOf(error)} (tekrar denenecek)` : messageOf(error)),
      locked_until: null,
      locked_by: null,
      next_run_at: retry ? new Date(Date.now() + delay) : null,
      finished_at: retry ? null : new Date(),
    })
  } finally {
    clearInterval(heartbeat)
  }
}

async function importItem(container: MedusaContainer, batch: BatchRow, item: ItemRow): Promise<Outcome> {
  const parsed = ProductDocumentSchema.safeParse(item.payload)

  if (!parsed.success) {
    throw new ImportException(issueLines(parsed.error).join("\n"))
  }

  const adapted = adaptProduct(parsed.data, batch.source)
  assertProduct(adapted.product)

  const categories = resolveCategories(await loadCategoryIndex(container), adapted.categories)
  const categoryId = batch.category_id ?? categories.value[0]

  if (!categoryId) {
    throw new ImportException("Ürünün kategorisi bulunamadı ve partide varsayılan kategori seçilmedi.")
  }

  const locationIds = stringsOf(batch.location_ids)
  const images = adapted.images === null ? "keep" : await buildImageSet(adapted.images, batch.image_base ?? null)
  const fingerprint = sha256(
    JSON.stringify([
      item.payload_sha256,
      batch.currency_code ?? "",
      categoryId,
      [...locationIds].sort(),
      images === "keep" ? "keep" : images.sources,
    ])
  )

  if (optionsOf(batch.options).skip_unchanged) {
    const productId = await unchangedProduct(container, item, fingerprint)

    if (productId) {
      return { kind: "skipped", productId, reason: "Değişiklik yok; ürün yeniden yazılmadı.", fingerprint }
    }
  }

  const collection = await resolveCollection(container, adapted.collection)
  adapted.product.extras = {
    ...adapted.product.extras,
    categoryIds: categories.value,
    collectionId: collection.value,
    typeId: await resolveType(container, adapted.type),
    tagIds: await resolveTags(container, adapted.tags),
  }

  const result = await writeProduct(
    container,
    container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService,
    adapted.product,
    categoryId,
    locationIds,
    batch.currency_code ?? null,
    { images }
  )
  const warnings = [...categories.warnings, ...collection.warnings, ...result.warnings]

  warnings.push(...(await assignGroup(container, result.productId, adapted)))
  warnings.push(...(await writeTranslations(container, result.productId, adapted.translations)))

  return {
    kind: "completed",
    productId: result.productId,
    created: result.created,
    fingerprint,
    warnings,
    result: {
      created: result.created,
      created_variants: result.createdVariants,
      updated_variants: result.updatedVariants,
      removed_variants: result.removedVariants,
      images: result.images,
      images_kept: result.imagesKept,
      currency: result.currency,
      category: result.category,
      stock: result.stock,
    },
  }
}

/** UnchangedProduct finds the product an earlier item wrote from the same input, if it still exists. */
async function unchangedProduct(
  container: MedusaContainer,
  item: ItemRow,
  fingerprint: string
): Promise<string | null> {
  const { rows } = await database(container).raw(
    `SELECT product_id FROM kibijson_item
     WHERE deleted_at IS NULL AND id <> ? AND code = ? AND color = ?
       AND status = 'completed' AND fingerprint = ? AND product_id IS NOT NULL
     ORDER BY finished_at DESC
     LIMIT 1`,
    [item.id, item.code, item.color, fingerprint]
  )
  const productId = rows[0]?.product_id

  if (typeof productId !== "string") {
    return null
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: { entity: string; fields: string[]; filters: Record<string, unknown> }) => Promise<{
      data: unknown[]
    }>
  }
  const { data } = await query.graph({ entity: "product", fields: ["id"], filters: { id: productId } })

  return data.length ? productId : null
}

/** AssignGroup applies the document's colour group, hex and position; a clash is reported only. */
async function assignGroup(
  container: MedusaContainer,
  productId: string,
  adapted: ReturnType<typeof adaptProduct>
): Promise<string[]> {
  const { mainCode, colorHex, position } = adapted.group

  if (mainCode === adapted.product.code && colorHex === undefined && position === undefined) {
    return []
  }

  const service = container.resolve(KIBIGROUP_MODULE) as KibigroupModuleService

  try {
    const current = await service.findMember(productId)
    await service.assign(productId, {
      main_code: mainCode,
      color: adapted.product.color ?? "",
      color_hex: colorHex !== undefined ? colorHex : current?.color_hex ?? null,
      position: position ?? current?.position ?? 0,
    })
    return []
  } catch (error) {
    return [`Renk grubu atanamadı: ${messageOf(error)}`]
  }
}

/**
 * RefreshBatch recounts the batch's items and closes a running batch with
 * nothing left to do. Its image folder is then archived unless another
 * open batch still reads it.
 */
export async function refreshBatch(container: MedusaContainer, batchId: string): Promise<void> {
  const db = database(container)
  const { rows } = await db.raw(
    `SELECT status, count(*)::int AS count, (count(*) FILTER (WHERE error IS NOT NULL))::int AS errored
     FROM kibijson_item
     WHERE batch_id = ? AND deleted_at IS NULL GROUP BY status`,
    [batchId]
  )
  const counts = new Map(rows.map((row) => [String(row.status), Number(row.count)]))
  const count = (status: string) => counts.get(status) ?? 0
  const open = count("pending") + count("processing")
  const failed =
    count("failed") +
    Number(rows.find((row) => row.status === "skipped")?.errored ?? 0)
  const { rows: closed } = await db.raw(
    `UPDATE kibijson_batch
     SET total = ?, pending = ?, completed = ?, failed = ?, skipped = ?, updated_at = now(),
         status = CASE WHEN status IN ('queued', 'running') AND ? = 0
                       THEN (CASE WHEN ? > 0 THEN 'completed_with_errors' ELSE 'completed' END)
                       ELSE status END,
         finished_at = CASE WHEN status IN ('queued', 'running') AND ? = 0 THEN now() ELSE finished_at END
     WHERE id = ? AND deleted_at IS NULL
     RETURNING status, finished_at, image_base, options`,
    [
      [...counts.values()].reduce((sum, value) => sum + value, 0),
      open,
      count("completed"),
      count("failed"),
      count("skipped") + count("cancelled"),
      open,
      failed,
      open,
      batchId,
    ]
  )
  const batch = closed[0]

  if (
    !batch ||
    open > 0 ||
    !["completed", "completed_with_errors"].includes(String(batch.status)) ||
    typeof batch.image_base !== "string" ||
    !batch.image_base ||
    !optionsOf(batch.options).archive_images ||
    failed > 0
  ) {
    return
  }

  await archiveImages(container, batchId, batch.image_base)
}

async function archiveImages(container: MedusaContainer, batchId: string, imageBase: string): Promise<void> {
  const db = database(container)
  const { rows } = await db.raw(
    `SELECT 1 FROM kibijson_batch
     WHERE deleted_at IS NULL AND id <> ? AND image_base = ?
       AND status IN ('ready', 'queued', 'running', 'paused')
     LIMIT 1`,
    [batchId, imageBase]
  )

  if (rows.length) {
    return
  }

  try {
    const archived = await archiveFolder(imageBase)

    if (archived) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .info(`kibijson: ${imageBase} görsel klasörü ${archived} olarak arşivlendi.`)
    }
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`kibijson: ${imageBase} arşivlenemedi: ${messageOf(error)}`)
  }
}

function database(container: MedusaContainer): Database {
  return container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Database
}
