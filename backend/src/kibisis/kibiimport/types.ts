export const IMPORT_STATUSES = ["pending", "processing", "completed", "failed"] as const

export type ImportStatus = (typeof IMPORT_STATUSES)[number]

export type ImportedAttribute = {
  name: string
  value: string
}

export type ImportedVariant = {
  barcode: string
  sku: string | null
  price: string | null
  compareAtPrice: string | null
  attributes: ImportedAttribute[]
  sortOrder: number
}

export type ImportedProduct = {
  source: string
  externalId: string
  code: string
  name: string
  locale: string
  brand: string | null
  color: string | null
  currency: string | null
  taxRate: string
  attributes: ImportedAttribute[]
  variants: ImportedVariant[]
  images: string[]
}

export type ImportResult = {
  productId: string
  code: string
  name: string
  created: boolean
  createdVariants: number
  updatedVariants: number
  removedVariants: number
  images: number
  warnings: string[]
  category: string
}

export type ImportJobDTO = {
  id: string
  url: string
  category_id: string
  category_name: string | null
  status: ImportStatus
  result: string | null
  exit_code: number | null
  started_at: string | null
  finished_at: string | null
  created_at: string | null
}

export type CategoryOption = {
  id: string
  name: string
}

export type ImportSummary = {
  completed: number
  failed: number
  queued: number
  lines: string[]
  skipped: string[]
}

export type ProductClient = {
  fetch(url: string): Promise<Record<string, unknown>>
}

export type ProductAdapter = {
  adapt(url: string, payload: Record<string, unknown>): ImportedProduct
}

export function isImportStatus(value: string): value is ImportStatus {
  return (IMPORT_STATUSES as readonly string[]).includes(value)
}
