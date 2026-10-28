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
  inStock: boolean
  extras?: VariantExtras
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
  colorUrls: string[]
  extras?: ProductExtras
}

/** A plain price of one currency. Amounts are major units, e.g. "1299.90". */
export type PriceEntry = {
  currency: string
  amount: string
  compareAt: string | null
}

export type PhysicalFields = {
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  material?: string | null
  originCountry?: string | null
  hsCode?: string | null
  midCode?: string | null
}

/**
 * Fields a full product document carries and a shop page does not. A field
 * left undefined keeps the importer's default.
 */
export type ProductExtras = PhysicalFields & {
  subtitle?: string | null
  description?: string | null
  handle?: string | null
  status?: "draft" | "published"
  discountable?: boolean
  categoryIds?: string[]
  collectionId?: string | null
  typeId?: string | null
  tagIds?: string[]
  metadata?: Record<string, unknown>
}

export type VariantExtras = PhysicalFields & {
  sku?: string | null
  title?: string | null
  ean?: string | null
  upc?: string | null
  /** Replaces `price`: every currency the variant is sold in. */
  prices?: PriceEntry[]
  /** Exact stock per chosen location instead of the import default. */
  quantity?: number | null
  manageInventory?: boolean
  allowBackorder?: boolean
  /** Positions in the product image list shown for this variant. */
  imageIndexes?: number[]
  metadata?: Record<string, unknown>
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
  /** The source images did not change, so the stored files were reused. */
  imagesKept: boolean
  currency: string
  warnings: string[]
  category: string
  stock: StockResult
  colorUrls: string[]
}

export type StockResult = {
  locations: string[]
  stocked: number
  soldOut: number
}

export type ImportJobDTO = {
  id: string
  url: string
  category_id: string
  category_name: string | null
  location_ids: string[]
  location_names: string[]
  currency_code: string | null
  parent_id: string | null
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

export type LocationOption = {
  id: string
  name: string
}

export type CurrencyOption = {
  code: string
  is_default: boolean
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
  /** Two links with the same key open the same source product. */
  productKey(url: string): string
}

export function isImportStatus(value: string): value is ImportStatus {
  return (IMPORT_STATUSES as readonly string[]).includes(value)
}
