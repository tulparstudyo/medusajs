import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

import { ImportException } from "../kibiimport/errors"
import { listCategories, listCurrencies, listLocations } from "../kibiimport/queue"
import { locationIdsOf } from "../kibiimport/service"
import { CategoryOption, CurrencyOption, LocationOption } from "../kibiimport/types"
import { KIBIJSON_MODULE } from "./index"
import { imageRoot, readDocumentFile } from "./local-images"
import { runPreflight } from "./preflight"
import { kick, refreshBatch } from "./runner"
import KibijsonModuleService, { optionsOf } from "./service"
import { BatchDTO, BatchOptions, BatchStatus, ItemDTO, ItemStatus } from "./types"

type Database = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

export type CreateBatchInput = {
  document?: unknown
  file?: string
  name?: string
  image_base?: string | null
  created_by?: string | null
}

export type StartBatchInput = {
  category_id?: string | null
  location_ids?: string[]
  currency_code?: string | null
  options?: Partial<BatchOptions>
}

export type BatchPage = {
  batches: BatchDTO[]
  categories: CategoryOption[]
  locations: LocationOption[]
  currencies: CurrencyOption[]
  image_root: string
}

export async function listBatchPage(container: MedusaContainer): Promise<BatchPage> {
  const service = kibijson(container)
  const [rows, categories, locations, currencies] = await Promise.all([
    service.listRecentBatches(),
    listCategories(container),
    listLocations(container),
    listCurrencies(container),
  ])

  return {
    batches: rows.map((row) => service.toBatch(row)),
    categories,
    locations,
    currencies,
    image_root: imageRoot(),
  }
}

export async function getBatchDetail(
  container: MedusaContainer,
  id: string,
  filter: { status?: ItemStatus; offset: number; limit: number }
): Promise<{ batch: BatchDTO; items: ItemDTO[]; count: number; offset: number; limit: number }> {
  const service = kibijson(container)
  const batch = await service.requireBatch(id)
  const [rows, count] = await service.listBatchItems(id, {
    status: filter.status,
    skip: filter.offset,
    take: filter.limit,
  })

  return {
    batch: service.toBatch(batch),
    items: rows.map((row) => service.toItem(row)),
    count,
    offset: filter.offset,
    limit: filter.limit,
  }
}

export async function createBatch(container: MedusaContainer, input: CreateBatchInput): Promise<BatchDTO> {
  if ((input.document === undefined) === !input.file) {
    throw invalid("JSON içeriği veya sunucudaki JSON dosyasının yolu gerekli (yalnızca biri).")
  }

  let document = input.document

  if (input.file) {
    try {
      document = await readDocumentFile(input.file)
    } catch (error) {
      throw invalid(error instanceof ImportException ? error.message : "JSON dosyası okunamadı.")
    }
  }

  const preflight = await runPreflight(container, document, input.image_base)
  const service = kibijson(container)
  const duplicate = await service.findActiveBatchByPayload(preflight.payloadSha256)

  if (duplicate) {
    throw invalid(`Aynı dosya "${duplicate.name}" partisinde zaten bekliyor.`)
  }

  const created = await service.createBatchWithItems(
    {
      name: (input.name?.trim() || input.file || `${preflight.envelope.source} ${new Date().toISOString()}`).slice(0, 200),
      source: preflight.envelope.source,
      schema: preflight.envelope.schema,
      payload_sha256: preflight.payloadSha256,
      image_base: preflight.imageBase,
      report: preflight.report,
      created_by: input.created_by ?? null,
    },
    preflight.items
  )

  return service.toBatch(await service.requireBatch(created.id))
}

/** StartBatch saves the import settings and schedules every pending item. */
export async function startBatch(
  container: MedusaContainer,
  id: string,
  input: StartBatchInput
): Promise<BatchDTO> {
  const service = kibijson(container)
  const batch = service.toBatch(await service.requireBatch(id))

  assertStatus(batch.status, ["ready"], "Yalnızca hazır bir parti başlatılabilir.")

  if (!batch.pending) {
    throw invalid("Partide içe aktarılabilecek ürün yok.")
  }

  const categoryId = input.category_id?.trim() || null
  const locationIds = locationIdsOf(input.location_ids ?? [])
  const [categories, locations, currencies] = await Promise.all([
    listCategories(container),
    listLocations(container),
    listCurrencies(container),
  ])

  if (categoryId && !categories.some((category) => category.id === categoryId)) {
    throw invalid("Kategori bulunamadı.")
  }

  if (!categoryId && (batch.report?.needs_category ?? 0) > 0) {
    throw invalid(
      `${batch.report?.needs_category} ürünün kategorisi dosyada bulunamadı; varsayılan bir kategori seçin.`
    )
  }

  const known = new Set(locations.map((location) => location.id))

  if (locationIds.some((locationId) => !known.has(locationId))) {
    throw invalid("Stok lokasyonu bulunamadı.")
  }

  const code = input.currency_code?.trim().toLowerCase()
  const currency = code
    ? currencies.find((option) => option.code === code)
    : currencies.find((option) => option.is_default) ?? currencies[0]

  if (!currency) {
    throw invalid("Para birimi mağazada tanımlı değil.")
  }

  await service.updateBatches({
    id,
    status: "queued",
    category_id: categoryId,
    location_ids: locationIds,
    currency_code: currency.code,
    options: optionsOf({ ...batch.options, ...(input.options ?? {}) }),
    finished_at: null,
  })
  await database(container).raw(
    `UPDATE kibijson_item SET next_run_at = now(), updated_at = now()
     WHERE batch_id = ? AND status = 'pending' AND deleted_at IS NULL`,
    [id]
  )
  kick(container)

  return service.toBatch(await service.requireBatch(id))
}

export async function pauseBatch(container: MedusaContainer, id: string): Promise<BatchDTO> {
  return await moveBatch(container, id, ["queued", "running"], "paused", "Yalnızca çalışan bir parti duraklatılabilir.")
}

export async function resumeBatch(container: MedusaContainer, id: string): Promise<BatchDTO> {
  const batch = await moveBatch(container, id, ["paused"], "queued", "Yalnızca duraklatılmış bir parti devam ettirilebilir.")
  kick(container)
  return batch
}

export async function cancelBatch(container: MedusaContainer, id: string): Promise<BatchDTO> {
  const service = kibijson(container)
  const batch = service.toBatch(await service.requireBatch(id))

  assertStatus(
    batch.status,
    ["ready", "queued", "running", "paused"],
    "Bu parti zaten bitti."
  )
  await service.updateBatches({ id, status: "cancelled", finished_at: new Date() })
  await database(container).raw(
    `UPDATE kibijson_item SET status = 'cancelled', next_run_at = NULL, finished_at = now(), updated_at = now()
     WHERE batch_id = ? AND status = 'pending' AND deleted_at IS NULL`,
    [id]
  )
  await refreshBatch(container, id)

  return service.toBatch(await service.requireBatch(id))
}

/** RetryBatch queues the failed items, the ones skipped with an error and the cancelled ones again. */
export async function retryBatch(container: MedusaContainer, id: string): Promise<BatchDTO> {
  const service = kibijson(container)
  const batch = service.toBatch(await service.requireBatch(id))

  assertStatus(
    batch.status,
    ["completed", "completed_with_errors", "cancelled", "paused", "running", "queued"],
    "Parti henüz başlatılmadı."
  )

  const { rows } = await database(container).raw(
    `UPDATE kibijson_item
     SET status = 'pending', attempts = 0, error = NULL, next_run_at = now(), finished_at = NULL, updated_at = now()
     WHERE batch_id = ? AND deleted_at IS NULL
       AND (status IN ('failed', 'cancelled') OR (status = 'skipped' AND error IS NOT NULL))
     RETURNING id`,
    [id]
  )

  if (!rows.length) {
    throw invalid("Yeniden denenecek ürün yok.")
  }

  return await requeue(container, id, batch.status)
}

export async function retryItem(container: MedusaContainer, batchId: string, itemId: string): Promise<BatchDTO> {
  const service = kibijson(container)
  const batch = service.toBatch(await service.requireBatch(batchId))
  const item = service.toItem(await service.requireItem(batchId, itemId))

  assertStatus(batch.status, ["completed", "completed_with_errors", "cancelled", "paused", "running", "queued"], "Parti henüz başlatılmadı.")

  if (!["failed", "skipped", "cancelled", "completed"].includes(item.status)) {
    throw invalid("Bu ürün zaten kuyrukta.")
  }

  await service.updateItems({
    id: itemId,
    status: "pending",
    attempts: 0,
    error: null,
    fingerprint: null,
    next_run_at: new Date(),
    finished_at: null,
  })

  return await requeue(container, batchId, batch.status)
}

export async function deleteBatch(container: MedusaContainer, id: string): Promise<void> {
  const service = kibijson(container)
  await service.requireBatch(id)
  const db = database(container)
  const { rows } = await db.raw(
    `SELECT 1 FROM kibijson_item WHERE batch_id = ? AND status = 'processing' AND deleted_at IS NULL LIMIT 1`,
    [id]
  )

  if (rows.length) {
    throw invalid("Parti şu an bir ürünü işliyor; bitince tekrar deneyin veya önce duraklatın.")
  }

  await db.raw(`UPDATE kibijson_item SET deleted_at = now() WHERE batch_id = ? AND deleted_at IS NULL`, [id])
  await service.softDeleteBatches(id)
}

/** PruneBatches removes finished batches older than the given age. Products stay. */
export async function pruneBatches(container: MedusaContainer, maxAgeMs: number): Promise<number> {
  const db = database(container)
  const cutoff = new Date(Date.now() - maxAgeMs)
  const { rows } = await db.raw(
    `UPDATE kibijson_batch SET deleted_at = now()
     WHERE deleted_at IS NULL AND status IN ('completed', 'completed_with_errors', 'cancelled')
       AND COALESCE(finished_at, updated_at) < ?
     RETURNING id`,
    [cutoff]
  )
  const ids = rows.map((row) => String(row.id))

  if (ids.length) {
    await db.raw(
      `UPDATE kibijson_item SET deleted_at = now()
       WHERE deleted_at IS NULL AND batch_id IN (${ids.map(() => "?").join(", ")})`,
      ids
    )
  }

  return ids.length
}

async function requeue(container: MedusaContainer, id: string, status: BatchStatus): Promise<BatchDTO> {
  const service = kibijson(container)

  if (status !== "paused") {
    await service.updateBatches({ id, status: "queued", finished_at: null })
    kick(container)
  }

  await refreshBatch(container, id)
  return service.toBatch(await service.requireBatch(id))
}

async function moveBatch(
  container: MedusaContainer,
  id: string,
  from: BatchStatus[],
  to: BatchStatus,
  message: string
): Promise<BatchDTO> {
  const service = kibijson(container)
  const batch = service.toBatch(await service.requireBatch(id))

  assertStatus(batch.status, from, message)
  await service.updateBatches({ id, status: to })

  return service.toBatch(await service.requireBatch(id))
}

function assertStatus(status: BatchStatus, allowed: BatchStatus[], message: string): void {
  if (!allowed.includes(status)) {
    throw invalid(message)
  }
}

function invalid(message: string): MedusaError {
  return new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

function kibijson(container: MedusaContainer): KibijsonModuleService {
  return container.resolve(KIBIJSON_MODULE) as KibijsonModuleService
}

function database(container: MedusaContainer): Database {
  return container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Database
}
