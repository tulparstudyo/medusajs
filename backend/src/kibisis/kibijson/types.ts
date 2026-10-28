export const BATCH_STATUSES = [
  "ready",
  "queued",
  "running",
  "paused",
  "completed",
  "completed_with_errors",
  "cancelled",
] as const

export type BatchStatus = (typeof BATCH_STATUSES)[number]

export const ITEM_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "skipped",
  "cancelled",
] as const

export type ItemStatus = (typeof ITEM_STATUSES)[number]

/** Batches the runner takes items from. */
export const ACTIVE_BATCH_STATUSES: BatchStatus[] = ["queued", "running"]

export type BatchOptions = {
  /** Skip a product whose document, currency, category and locations match its last import. */
  skip_unchanged: boolean
  /** Move the FTP image folder to `_processed` when the batch is done. */
  archive_images: boolean
}

export const DEFAULT_BATCH_OPTIONS: BatchOptions = {
  skip_unchanged: true,
  archive_images: true,
}

export type ReportLine = {
  position: number
  code: string
  color: string
  level: "error" | "warning"
  message: string
}

export type PreflightReport = {
  products: number
  variants: number
  images: { local: number; remote: number; missing: number }
  ready: number
  invalid: number
  needs_category: number
  lines: ReportLine[]
}

export type BatchDTO = {
  id: string
  name: string
  source: string
  schema: string
  image_base: string | null
  status: BatchStatus
  category_id: string | null
  location_ids: string[]
  currency_code: string | null
  options: BatchOptions
  report: PreflightReport | null
  total: number
  pending: number
  completed: number
  failed: number
  skipped: number
  created_by: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string | null
}

export type ItemResult = {
  created: boolean
  created_variants: number
  updated_variants: number
  removed_variants: number
  images: number
  images_kept: boolean
  currency: string
  category: string
  stock: { locations: string[]; stocked: number; soldOut: number }
}

export type ItemDTO = {
  id: string
  batch_id: string
  position: number
  external_id: string
  code: string
  color: string
  title: string
  status: ItemStatus
  attempts: number
  max_attempts: number
  next_run_at: string | null
  product_id: string | null
  created: boolean | null
  result: ItemResult | null
  warnings: string[]
  error: string | null
  started_at: string | null
  finished_at: string | null
}

export function isBatchStatus(value: string): value is BatchStatus {
  return (BATCH_STATUSES as readonly string[]).includes(value)
}

export function isItemStatus(value: string): value is ItemStatus {
  return (ITEM_STATUSES as readonly string[]).includes(value)
}
