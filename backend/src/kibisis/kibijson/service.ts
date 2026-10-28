import { MedusaError, MedusaService } from "@medusajs/framework/utils"

import Batch from "./models/batch"
import Item from "./models/item"
import {
  BatchDTO,
  BatchOptions,
  DEFAULT_BATCH_OPTIONS,
  isBatchStatus,
  isItemStatus,
  ItemDTO,
  ItemResult,
  ItemStatus,
  PreflightReport,
} from "./types"

type When = Date | string | null | undefined

export type BatchRow = {
  id: string
  name: string
  source: string
  schema: string
  payload_sha256: string
  image_base?: string | null
  status: string
  category_id?: string | null
  location_ids?: unknown
  currency_code?: string | null
  options?: unknown
  report?: unknown
  total?: number | null
  pending?: number | null
  completed?: number | null
  failed?: number | null
  skipped?: number | null
  created_by?: string | null
  started_at?: When
  finished_at?: When
  created_at?: When
}

export type ItemRow = {
  id: string
  batch_id: string
  position: number
  external_id: string
  code: string
  color: string
  title: string
  payload: unknown
  payload_sha256: string
  fingerprint?: string | null
  category_ids?: unknown
  status: string
  attempts?: number | null
  max_attempts?: number | null
  next_run_at?: When
  product_id?: string | null
  created?: boolean | null
  result?: unknown
  warnings?: unknown
  error?: string | null
  started_at?: When
  finished_at?: When
}

export type NewItem = {
  position: number
  external_id: string
  code: string
  color: string
  title: string
  payload: Record<string, unknown>
  payload_sha256: string
  category_ids: string[]
  status: Extract<ItemStatus, "pending" | "skipped">
  error: string | null
  warnings: string[]
}

const CREATE_CHUNK = 200
const RECENT_LIMIT = 20
const ERROR_LIMIT = 8000

class KibijsonModuleService extends MedusaService({
  Batch,
  Item,
}) {
  async listRecentBatches(): Promise<BatchRow[]> {
    return (await this.listBatches(
      {},
      { take: RECENT_LIMIT, order: { created_at: "DESC" } }
    )) as BatchRow[]
  }

  async requireBatch(id: string): Promise<BatchRow> {
    const [row] = (await this.listBatches({ id }, { take: 1 })) as BatchRow[]

    if (!row) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Parti bulunamadı.")
    }

    return row
  }

  async requireItem(batchId: string, id: string): Promise<ItemRow> {
    const [row] = (await this.listItems({ id, batch_id: batchId }, { take: 1 })) as ItemRow[]

    if (!row) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Ürün satırı bulunamadı.")
    }

    return row
  }

  async findActiveBatchByPayload(sha256: string): Promise<BatchRow | null> {
    const [row] = (await this.listBatches(
      { payload_sha256: sha256, status: ["ready", "queued", "running", "paused"] },
      { take: 1 }
    )) as BatchRow[]

    return row ?? null
  }

  async createBatchWithItems(
    batch: {
      name: string
      source: string
      schema: string
      payload_sha256: string
      image_base: string | null
      report: PreflightReport
      created_by: string | null
    },
    items: NewItem[]
  ): Promise<BatchRow> {
    const pending = items.filter((item) => item.status === "pending").length
    const created = (await this.createBatches({
      ...batch,
      status: "ready",
      options: DEFAULT_BATCH_OPTIONS,
      report: batch.report as unknown as Record<string, unknown>,
      total: items.length,
      pending,
      skipped: items.length - pending,
    })) as BatchRow

    for (let start = 0; start < items.length; start += CREATE_CHUNK) {
      await this.createItems(
        items.slice(start, start + CREATE_CHUNK).map((item) => ({
          ...item,
          batch_id: created.id,
          error: item.error ? clip(item.error) : null,
          warnings: item.warnings as unknown as Record<string, unknown>,
        }))
      )
    }

    return created
  }

  async listBatchItems(
    batchId: string,
    filter: { status?: ItemStatus; skip: number; take: number }
  ): Promise<[ItemRow[], number]> {
    const [rows, count] = await this.listAndCountItems(
      { batch_id: batchId, ...(filter.status ? { status: filter.status } : {}) },
      { skip: filter.skip, take: filter.take, order: { position: "ASC" } }
    )

    return [rows as ItemRow[], count]
  }

  toBatch(row: BatchRow): BatchDTO {
    return {
      id: row.id,
      name: row.name,
      source: row.source,
      schema: row.schema,
      image_base: row.image_base ?? null,
      status: isBatchStatus(row.status) ? row.status : "ready",
      category_id: row.category_id ?? null,
      location_ids: stringsOf(row.location_ids),
      currency_code: row.currency_code ?? null,
      options: optionsOf(row.options),
      report: (row.report as PreflightReport | null) ?? null,
      total: row.total ?? 0,
      pending: row.pending ?? 0,
      completed: row.completed ?? 0,
      failed: row.failed ?? 0,
      skipped: row.skipped ?? 0,
      created_by: row.created_by ?? null,
      started_at: iso(row.started_at),
      finished_at: iso(row.finished_at),
      created_at: iso(row.created_at),
    }
  }

  toItem(row: ItemRow): ItemDTO {
    return {
      id: row.id,
      batch_id: row.batch_id,
      position: row.position,
      external_id: row.external_id,
      code: row.code,
      color: row.color,
      title: row.title,
      status: isItemStatus(row.status) ? row.status : "pending",
      attempts: row.attempts ?? 0,
      max_attempts: row.max_attempts ?? 0,
      next_run_at: iso(row.next_run_at),
      product_id: row.product_id ?? null,
      created: row.created ?? null,
      result: (row.result as ItemResult | null) ?? null,
      warnings: stringsOf(row.warnings),
      error: row.error ?? null,
      started_at: iso(row.started_at),
      finished_at: iso(row.finished_at),
    }
  }
}

export function optionsOf(value: unknown): BatchOptions {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<BatchOptions>)
    : {}

  return {
    skip_unchanged:
      typeof record.skip_unchanged === "boolean"
        ? record.skip_unchanged
        : DEFAULT_BATCH_OPTIONS.skip_unchanged,
    archive_images:
      typeof record.archive_images === "boolean"
        ? record.archive_images
        : DEFAULT_BATCH_OPTIONS.archive_images,
  }
}

export function stringsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item !== "")
    : []
}

export function clip(value: string): string {
  const text = value.trim()
  return text.length > ERROR_LIMIT ? text.slice(0, ERROR_LIMIT) : text
}

function iso(value: When): string | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export default KibijsonModuleService
