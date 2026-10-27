import { ImportException } from "../../errors"
import { isColorLabel } from "../../lib/color"
import { compareMoney, roundMoney } from "../../money"
import { ImportedAttribute, ImportedProduct, ImportedVariant, ProductAdapter } from "../../types"
import { decodeEntities } from "./parse"

type Json = Record<string, unknown>

type Page = {
  id: string
  ld: Json
  size: string
  record: Json
}

type Pricing = {
  base: string | null
  old: string | null
  inStock: boolean
  listed: Map<string, Json>
}

/** Kozmoya products without a colour option still need a colour for the importer. */
const NO_COLOR = "Standart"

/**
 * KozmoyaAdapter maps the pages of a Kozmoya (OpenCart) product to a
 * shop-neutral product. Every size is a separate OpenCart product, so each
 * size page becomes variants under the size axis. When the page option is a
 * colour, every colour is a product of its own, like a Trendyol colour: the
 * colour is picked by its variant link (-v-SKU) and the other colours come
 * back as links. Any other option becomes a second axis.
 * The size with the lowest OpenCart id names the product, so every size link
 * leads to the same product.
 */
export class KozmoyaAdapter implements ProductAdapter {
  productKey(url: string): string {
    try {
      const address = new URL(url.trim())
      const id = address.searchParams.get("product_id")

      if (id && /^\d+$/.test(id)) {
        return `kozmoya:id:${id}`
      }

      return `kozmoya:${decodeURIComponent(address.pathname).toLowerCase().replace(/\/+$/, "")}`
    } catch {
      return url.trim()
    }
  }

  adapt(url: string, payload: Record<string, unknown>): ImportedProduct {
    const pages = pagesOf(payload.pages)

    if (!pages.length) {
      throw new ImportException("Kozmoya ürününün kimliği yok.")
    }

    const requestedId = text(payload.requestedId) || (pages[0] as Page).id
    assertLinkMatches(url, requestedId)

    const requested = pages.find((page) => page.id === requestedId) ?? (pages[0] as Page)
    const main = [...pages].sort((left, right) => Number(left.id) - Number(right.id))[0] as Page
    const sizeAxis = text(payload.sizeName) && pages.some((page) => page.size) ? text(payload.sizeName) : null
    const offer = firstOffer(main.ld.offers)
    const currency = text(offer?.priceCurrency) || text(main.record.currency)
    const fullName = clean(text(main.ld.name)) || text(main.record.title) || `Kozmoya ${main.id}`
    const name = sizeAxis ? withoutSize(fullName, main.size) : fullName
    const shared = {
      source: "kozmoya",
      externalId: main.id,
      code: `kz-${main.id}`,
      locale: "tr",
      brand: clean(text(asRecord(main.ld.brand)?.name)) || null,
      currency: currency ? currency.toUpperCase() : null,
      taxRate: "20",
      attributes: attributesOf(main.ld),
    }
    const colors = colorGroupOf(requested)

    if (colors) {
      const chosen = chosenColor(colors, text(payload.requestedSku))
      const color = clean(text(chosen.label))

      return {
        ...shared,
        name: `${name} - ${color}`,
        color,
        variants: colorVariants(pages, color, sizeAxis),
        images: colorImages(pages, color),
        colorUrls: colorLinks(requested, colors, chosen),
      }
    }

    return {
      ...shared,
      name,
      color: NO_COLOR,
      variants: variantsOf(pages, sizeAxis),
      images: imagesOf(pages),
      colorUrls: [],
    }
  }
}

/**
 * ColorGroupOf returns the page option when it lists colours: the structured
 * data says the product varies by colour, or the option is named after colour.
 */
function colorGroupOf(page: Page): Json | null {
  const group = optionGroupOf(page)

  if (!group) {
    return null
  }

  const variesBy = Array.isArray(page.ld.variesBy) ? page.ld.variesBy : [page.ld.variesBy]
  const byData = variesBy.some((value) => /color/i.test(text(value)))

  return byData || /renk|colou?r/i.test(text(group.name)) ? group : null
}

function chosenColor(group: Json, sku: string): Json {
  const values = asArray(group.values)
    .map((row) => asRecord(row))
    .filter((row): row is Json => !!row && clean(text(row.label)) !== "")

  if (sku) {
    const found = values.find((value) => text(value.sku).toLowerCase() === sku.toLowerCase())

    if (!found) {
      throw new ImportException(`Kozmoya sayfasında ${sku} renk seçeneği bulunamadı.`)
    }

    return found
  }

  const first = values[0]

  if (!first) {
    throw new ImportException("Kozmoya ürününün renk seçeneği yok.")
  }

  return first
}

function colorValueOf(page: Page, color: string): Json | null {
  const group = colorGroupOf(page) ?? optionGroupOf(page)
  const wanted = sameLabel(color)

  return (
    asArray(group?.values)
      .map((row) => asRecord(row))
      .find((row) => !!row && sameLabel(text(row.label)) === wanted) ?? null
  )
}

function colorVariants(pages: Page[], color: string, sizeAxis: string | null): ImportedVariant[] {
  const barcodes = new Set<string>()
  const variants: ImportedVariant[] = []

  for (const page of pages) {
    const value = colorValueOf(page, color)

    if (!value) {
      continue
    }

    const size: ImportedAttribute[] = sizeAxis ? [{ name: sizeAxis, value: page.size || "Standart" }] : []
    const variant = valueVariant(page, value, size, pricingOf(page))
    const barcode = barcodes.has(variant.barcode) ? `${variant.fallback}-${page.id}` : variant.barcode

    barcodes.add(barcode)
    variants.push({
      barcode,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      attributes: variant.attributes,
      sortOrder: variants.length,
      inStock: variant.inStock,
    })
  }

  return variants
}

/**
 * ColorImages puts the pictures of the colour first, size by size, and the
 * product gallery after them.
 */
function colorImages(pages: Page[], color: string): string[] {
  const own = pages.flatMap((page) => asArray(colorValueOf(page, color)?.images))
  const images: string[] = []

  for (const image of [...own, ...imagesOf(pages)]) {
    if (typeof image === "string" && image.startsWith("https://") && !images.includes(image)) {
      images.push(image)
    }
  }

  return images
}

/**
 * ColorLinks returns the variant link of every other colour. The shop lists
 * those links in its structured data; a value missing there gets its link
 * built from the page address and the value SKU.
 */
function colorLinks(page: Page, group: Json, chosen: Json): string[] {
  const listed = listedVariants(page.ld.hasVariant)
  const base = text(page.record.url)
  const links: string[] = []

  for (const row of asArray(group.values)) {
    const value = asRecord(row)

    if (!value || value === chosen || !clean(text(value.label))) {
      continue
    }

    const offerUrl = text(listed.get(text(value.barcode))?.url)
    const sku = text(value.sku)
    const link = shopLink(offerUrl) ?? (sku && base ? shopLink(`${base}-v-${encodeURIComponent(sku)}`) : null)

    if (link && !links.includes(link)) {
      links.push(link)
    }
  }

  return links
}

function shopLink(value: string): string | null {
  try {
    const address = new URL(value)

    return address.protocol === "https:" && /(^|\.)kozmoya\.com$/i.test(address.hostname) && !address.search
      ? address.toString()
      : null
  } catch {
    return null
  }
}

function sameLabel(value: string): string {
  return clean(value).replace(/\s+/g, " ").toLocaleLowerCase("tr")
}

function pagesOf(value: unknown): Page[] {
  return asArray(value).flatMap((row) => {
    const record = asRecord(row)
    const id = text(record?.productId)
    const ld = asRecord(record?.ld)

    return record && /^\d+$/.test(id) && ld ? [{ id, ld, size: clean(text(record.size)), record }] : []
  })
}

function assertLinkMatches(url: string, id: string): void {
  let linked: string | null = null

  try {
    linked = new URL(url).searchParams.get("product_id")
  } catch {
    return
  }

  if (linked && linked !== id) {
    throw new ImportException("Kozmoya sayfası linkteki ürünle eşleşmiyor.")
  }
}

/**
 * WithoutSize drops the size from the product name, so "Tıraş Jeli 50ml"
 * names the product that is sold in 50ml, 150ml and 450ml.
 */
export function withoutSize(name: string, size: string): string {
  const tokens = size.match(/\d+(?:[.,]\d+)?|[^\d\s]+/gu)

  if (!tokens) {
    return name
  }

  const pattern = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*")
  const stripped = name
    .replace(new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, "giu"), " ")
    .replace(/\s+/g, " ")
    .replace(/[\s|,/-]+$/u, "")
    .trim()

  return stripped || name
}

function attributesOf(ld: Json): ImportedAttribute[] {
  const properties: ImportedAttribute[] = []

  for (const row of asArray(ld.additionalProperty)) {
    const property = asRecord(row)
    const name = clean(text(property?.name))
    const value = clean(text(property?.value))

    if (name && value && !isColorLabel(name)) {
      properties.push({ name, value })
    }
  }

  const description = clean(text(ld.description))

  if (description && !properties.some((property) => property.value === description)) {
    return [{ name: "Açıklama", value: description }, ...properties]
  }

  return properties
}

function variantsOf(pages: Page[], sizeAxis: string | null): ImportedVariant[] {
  const optionAxis = optionAxisOf(pages)
  const barcodes = new Set<string>()
  const variants: ImportedVariant[] = []

  for (const page of pages) {
    const size: ImportedAttribute[] = sizeAxis ? [{ name: sizeAxis, value: page.size || "Standart" }] : []

    for (const variant of pageVariants(page, optionAxis)) {
      let barcode = variant.barcode

      if (barcodes.has(barcode)) {
        barcode = `${variant.fallback}-${page.id}`
      }

      barcodes.add(barcode)
      variants.push({
        barcode,
        sku: variant.sku,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        attributes: [...size, ...variant.attributes],
        sortOrder: variants.length,
        inStock: variant.inStock,
      })
    }
  }

  return variants
}

function optionAxisOf(pages: Page[]): string {
  for (const page of pages) {
    const group = optionGroupOf(page)
    const name = clean(text(group?.name))

    if (name) {
      return name
    }
  }

  return "Seçenek"
}

function optionGroupOf(page: Page): Json | null {
  return (
    asArray(page.record.options)
      .map((row) => asRecord(row))
      .find((row) => asArray(row?.values).length > 0) ?? null
  )
}

type PageVariant = Omit<ImportedVariant, "sortOrder"> & { fallback: string }

function pageVariants(page: Page, axis: string): PageVariant[] {
  const pricing = pricingOf(page)
  const group = optionGroupOf(page)
  const labels = new Set<string>()
  const variants: PageVariant[] = []

  for (const row of asArray(group?.values)) {
    const value = asRecord(row)
    const label = clean(text(value?.label))

    if (!value || !label || labels.has(label)) {
      continue
    }

    labels.add(label)
    variants.push(valueVariant(page, value, [{ name: axis, value: label }], pricing))
  }

  if (variants.length) {
    return variants
  }

  return [
    {
      barcode: text(page.ld.gtin) || text(page.ld.gtin13) || `kz-${page.id}`,
      fallback: `kz-${page.id}`,
      sku: text(page.ld.mpn) || text(page.ld.sku) || null,
      price: pricing.base,
      compareAtPrice: compareAt(pricing.old, pricing.base),
      attributes: [],
      inStock: pricing.inStock,
    },
  ]
}

function pricingOf(page: Page): Pricing {
  const offer = firstOffer(page.ld.offers)

  return {
    base: money(offer?.price) ?? money(text(page.record.price)),
    old: money(text(page.record.oldPrice)),
    inStock: available(text(offer?.availability), text(page.record.stock)),
    listed: listedVariants(page.ld.hasVariant),
  }
}

/**
 * ValueVariant turns one option value into a variant. The barcode, SKU and
 * stock come from the value; the price from the structured data offer of
 * that barcode, else the page price.
 */
function valueVariant(page: Page, value: Json, attributes: ImportedAttribute[], pricing: Pricing): PageVariant {
  const barcode = text(value.barcode)
  const fallback = `kz-${page.id}-${text(value.id)}`
  const offer = barcode ? pricing.listed.get(barcode) : undefined
  const price = money(offer?.price) ?? pricing.base
  const stock = text(value.stock)

  return {
    barcode: barcode || fallback,
    fallback,
    sku: text(value.sku) || null,
    price,
    compareAtPrice:
      price && pricing.base && compareMoney(price, pricing.base) === 0 ? compareAt(pricing.old, price) : null,
    attributes,
    inStock: stock ? stock === "var" : offer ? available(text(offer.availability), "") : pricing.inStock,
  }
}

/**
 * ListedVariants indexes the offers of the ProductGroup variants by barcode.
 */
function listedVariants(value: unknown): Map<string, Json> {
  const offers = new Map<string, Json>()

  for (const row of asArray(value)) {
    const variant = asRecord(row)
    const barcode = text(variant?.gtin) || text(variant?.gtin13)
    const offer = firstOffer(variant?.offers)

    if (barcode && offer && !offers.has(barcode)) {
      offers.set(barcode, offer)
    }
  }

  return offers
}

function firstOffer(value: unknown): Json | null {
  return Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
}

function available(availability: string, stock: string): boolean {
  if (availability) {
    return !/OutOfStock|SoldOut|Discontinued/i.test(availability)
  }

  if (stock) {
    return !/yok|tükendi/i.test(stock)
  }

  return true
}

function compareAt(old: string | null, price: string | null): string | null {
  if (!old || !price || compareMoney(old, price) <= 0) {
    return null
  }

  return old
}

function imagesOf(pages: Page[]): string[] {
  const images: string[] = []

  for (const page of pages) {
    const gallery = asArray(page.record.images)
    const sources = gallery.length ? gallery : Array.isArray(page.ld.image) ? page.ld.image : [page.ld.image]

    for (const image of sources) {
      if (typeof image === "string" && image.startsWith("https://") && !images.includes(image)) {
        images.push(image)
      }
    }
  }

  return images
}

/**
 * Clean decodes entities and trims every line. The shop text keeps its line
 * breaks because the attributes are printed into the product description.
 */
function clean(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n")
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
