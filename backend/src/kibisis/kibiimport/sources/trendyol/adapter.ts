import { ImportException } from "../../errors"
import { isColorLabel } from "../../lib/color"
import { compareMoney, roundMoney } from "../../money"
import { ImportedAttribute, ImportedProduct, ImportedVariant, ProductAdapter } from "../../types"

type Json = Record<string, unknown>

/**
 * TrendyolAdapter maps a Trendyol product document to a shop-neutral product.
 * Size rows become variants. Properties shared by every size stay on the product.
 */
export class TrendyolAdapter implements ProductAdapter {
  adapt(url: string, payload: Record<string, unknown>): ImportedProduct {
    const product = asRecord(payload.product)

    if (!product || !text(product.id)) {
      throw new ImportException("Trendyol ürününün kimliği yok.")
    }

    const id = text(product.id)
    assertLinkMatches(url, id)

    const axes = axisNames(product)
    const winnerPrice = asRecord(asRecord(asRecord(product.merchantListing)?.winnerVariant)?.price)
    const currency = text(winnerPrice?.currency)
    const shared = text(product.productGroupId)

    return {
      source: "trendyol",
      externalId: id,
      code: shared ? `ty-${shared}` : `ty-${id}`,
      name: text(product.name) || `Trendyol ${id}`,
      locale: locale(text(payload.culture) || "tr-TR"),
      brand: text(asRecord(product.brand)?.name) || null,
      color: colorOf(product),
      currency: currency ? currency.toUpperCase() : null,
      taxRate: tax(product.tax),
      attributes: sharedAttributes(product, axes),
      variants: variantsOf(product, axes, winnerPrice),
      images: imagesOf(product),
    }
  }
}

function assertLinkMatches(url: string, id: string): void {
  const match = url.match(/-p-(\d+)/)

  if (match && match[1] !== id) {
    throw new ImportException("Trendyol sayfası linkteki ürünle eşleşmiyor.")
  }
}

function axisNames(product: Json): string[] {
  const names: string[] = []
  const variantAttributes = asRecord(asRecord(product.merchantListing)?.winnerVariant)?.variantAttributes

  for (const attribute of asArray(variantAttributes)) {
    const name = text(asRecord(attribute)?.attributeName)

    if (name && !isColorLabel(name) && !names.includes(name)) {
      names.push(name)
    }
  }

  if (!names.length && asArray(product.variants).length > 1) {
    names.push("Beden")
  }

  return names
}

function sharedAttributes(product: Json, axes: string[]): ImportedAttribute[] {
  const attributes: ImportedAttribute[] = []

  for (const attribute of asArray(product.attributes)) {
    const row = asRecord(attribute)
    const name = text(asRecord(row?.key)?.name)
    const value = text(asRecord(row?.value)?.name)

    if (!name || !value || axes.includes(name) || isColorLabel(name)) {
      continue
    }

    attributes.push({ name, value })
  }

  return attributes
}

function colorOf(product: Json): string | null {
  for (const attribute of asArray(product.attributes)) {
    const row = asRecord(attribute)
    const name = text(asRecord(row?.key)?.name)
    const value = text(asRecord(row?.value)?.name)

    if (value && isColorLabel(name)) {
      return value
    }
  }

  return null
}

function variantsOf(product: Json, axes: string[], winnerPrice: Json | null): ImportedVariant[] {
  const rows = asArray(product.variants)
  const compareAt = compareAtPrice(winnerPrice)
  const fallback = money(asRecord(winnerPrice?.sellingPrice)?.value)
  const axisName = axes[0] ?? null
  const variants: ImportedVariant[] = []

  rows.forEach((row, index) => {
    const record = asRecord(row)

    if (!record) {
      return
    }

    const value = text(record.value)
    let barcode = text(record.barcode)

    if (!barcode) {
      barcode = `ty-${text(product.id)}${value ? `-${value}` : ""}`
    }

    const attributes: ImportedAttribute[] = []

    if (axisName && value) {
      attributes.push({ name: axisName, value })
    }

    variants.push({
      barcode,
      sku: text(record.itemNumber) || null,
      price: money(asRecord(record.price)?.value) ?? fallback,
      compareAtPrice: compareAt,
      attributes,
      sortOrder: index,
    })
  })

  if (variants.length) {
    return variants
  }

  return [
    {
      barcode: text(product.productCode) || `ty-${text(product.id)}`,
      sku: null,
      price: fallback,
      compareAtPrice: compareAt,
      attributes: [],
      sortOrder: 0,
    },
  ]
}

function compareAtPrice(price: Json | null): string | null {
  const selling = money(asRecord(price?.sellingPrice)?.value)
  const original = money(asRecord(price?.originalPrice)?.value)

  if (!selling || !original || compareMoney(original, selling) <= 0) {
    return null
  }

  return original
}

function imagesOf(product: Json): string[] {
  const images: string[] = []

  for (const image of asArray(product.images)) {
    if (typeof image === "string" && image.startsWith("https://") && !images.includes(image)) {
      images.push(image)
    }
  }

  return images
}

function tax(value: unknown): string {
  if (typeof value !== "number" && typeof value !== "string") {
    return "20"
  }

  const rate = Number(value)

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return "20"
  }

  return String(rate)
}

function locale(culture: string): string {
  const language = culture.slice(0, 2).toLowerCase()

  return /^[a-z]{2}$/.test(language) ? language : "tr"
}

function money(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null
  }

  return roundMoney(value)
}

function text(value: unknown): string {
  if (typeof value === "string") {
    return value.trim()
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  return ""
}

function asRecord(value: unknown): Json | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Json
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
