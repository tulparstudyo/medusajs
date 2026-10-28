import { ImportedAttribute, ImportedProduct, ImportedVariant, PriceEntry } from "../kibiimport/types"
import { CategoryRef, ProductDocument } from "./schema"

const DEFAULT_TAX_RATE = "20"

export type Translations = NonNullable<ProductDocument["translations"]>

/** What the runner needs besides the importer's product. */
export type AdaptedProduct = {
  product: ImportedProduct
  /** Image entries in order; null leaves the product's images as they are. */
  images: string[] | null
  categories: CategoryRef[]
  collection: string | null | undefined
  type: string | null | undefined
  tags: string[] | undefined
  group: { mainCode: string; colorHex: string | null | undefined; position: number | undefined }
  translations: Translations
}

export function colorOf(document: ProductDocument): { name: string; hex: string | null | undefined } {
  return typeof document.color === "string"
    ? { name: document.color, hex: undefined }
    : { name: document.color.name, hex: document.color.hex }
}

export function adaptProduct(document: ProductDocument, source: string): AdaptedProduct {
  const color = colorOf(document)
  const images = document.images ? orderedImages(document.images) : null
  const axes = axesOf(document)
  const currency = document.currency ?? null

  return {
    product: {
      source: `json:${source}`,
      externalId: document.external_id,
      code: document.code,
      name: document.title,
      locale: (document.locale ?? "tr").slice(0, 2).toLowerCase(),
      brand: document.brand ?? null,
      color: color.name,
      currency: currency ? currency.toUpperCase() : null,
      taxRate: taxRateOf(document.tax_rate),
      attributes: document.attributes.map((attribute) => ({
        name: attribute.name,
        value: attribute.value,
      })),
      variants: document.variants.map((variant, index) =>
        adaptVariant(variant, index, axes, currency, images?.keys ?? { names: [], fromDocument: [] })
      ),
      images: images?.entries ?? [],
      colorUrls: [],
      extras: {
        subtitle: document.subtitle,
        description: document.description ?? undefined,
        handle: document.handle,
        status: document.status,
        discountable: document.discountable,
        ...physicalOf(document.physical),
        metadata: metadataOf(document),
      },
    },
    images: images?.entries ?? null,
    categories: document.categories ?? [],
    collection: document.collection,
    type: document.type,
    tags: document.tags,
    group: {
      mainCode: document.group?.main_code ?? document.code,
      colorHex: color.hex,
      position: document.group?.position,
    },
    translations: document.translations ?? {},
  }
}

/** OrderedImages sorts by `position` and keeps document order for equal or missing positions. */
function orderedImages(images: NonNullable<ProductDocument["images"]>): {
  entries: string[]
  keys: ImageKeys
} {
  const rows = images.map((entry, index) =>
    typeof entry === "string"
      ? { value: entry, key: null, position: index, index }
      : {
          value: entry.path ?? entry.url ?? "",
          key: entry.key ?? null,
          position: entry.position ?? index,
          index,
        }
  )

  rows.sort((left, right) => left.position - right.position || left.index - right.index)

  const fromDocument: number[] = []
  rows.forEach((row, sorted) => {
    fromDocument[row.index] = sorted
  })

  return {
    entries: rows.map((row) => row.value),
    keys: { names: rows.map((row) => row.key), fromDocument },
  }
}

type ImageKeys = {
  /** Image key per sorted position. */
  names: (string | null)[]
  /** Sorted position per position in the document. */
  fromDocument: number[]
}

function axesOf(document: ProductDocument): string[] {
  const axes = (document.options ?? []).map((option) => option.title)

  for (const variant of document.variants) {
    for (const name of Object.keys(variant.options)) {
      if (!axes.includes(name)) {
        axes.push(name)
      }
    }
  }

  return axes
}

function adaptVariant(
  variant: ProductDocument["variants"][number],
  index: number,
  axes: string[],
  currency: string | null,
  imageKeys: ImageKeys
): ImportedVariant {
  const prices: PriceEntry[] = variant.prices.map((price) => ({
    currency: price.currency_code,
    amount: price.amount,
    compareAt: price.compare_at_amount ?? null,
  }))
  const primary = prices.find((price) => price.currency === currency) ?? prices[0] ?? null
  const attributes: ImportedAttribute[] = axes.flatMap((axis) => {
    const value = variant.options[axis]
    return value ? [{ name: axis, value }] : []
  })
  const inventory = variant.inventory
  const quantity = inventory.quantity ?? null

  return {
    barcode: variant.barcode,
    sku: variant.sku ?? null,
    price: primary?.amount ?? null,
    compareAtPrice: primary?.compareAt ?? null,
    attributes,
    sortOrder: variant.sort_order ?? index,
    inStock: inventory.in_stock ?? (quantity === null ? true : quantity > 0),
    extras: {
      sku: variant.sku,
      title: variant.title,
      ean: variant.ean,
      upc: variant.upc,
      prices: prices.length ? prices : undefined,
      quantity: inventory.quantity,
      manageInventory: inventory.manage_inventory,
      allowBackorder: inventory.allow_backorder,
      ...physicalOf(variant.physical),
      imageIndexes: variant.images ? imageIndexes(variant.images, imageKeys) : undefined,
      metadata: variant.metadata,
    },
  }
}

/** ImageIndexes maps keys and document positions to the sorted image list. */
function imageIndexes(refs: (string | number)[], keys: ImageKeys): number[] {
  return refs.flatMap((ref) => {
    if (typeof ref === "number") {
      const sorted = keys.fromDocument[ref]
      return sorted === undefined ? [] : [sorted]
    }

    const index = keys.names.indexOf(ref)
    return index >= 0 ? [index] : []
  })
}

function physicalOf(fields: ProductDocument["physical"]) {
  if (!fields) {
    return {}
  }

  return {
    weight: fields.weight,
    length: fields.length,
    height: fields.height,
    width: fields.width,
    material: fields.material,
    originCountry: fields.origin_country,
    hsCode: fields.hs_code,
    midCode: fields.mid_code,
  }
}

function metadataOf(document: ProductDocument): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = { ...(document.metadata ?? {}) }

  if (document.seo) {
    metadata.seo = document.seo
  }

  if (document.source_url) {
    metadata.source_url = document.source_url
  }

  if (document.related) {
    metadata.related = document.related
  }

  return Object.keys(metadata).length ? metadata : undefined
}

function taxRateOf(value: string | undefined): string {
  const rate = Number(value)
  return value !== undefined && value !== "" && Number.isFinite(rate) && rate >= 0 && rate <= 100
    ? String(rate)
    : DEFAULT_TAX_RATE
}
