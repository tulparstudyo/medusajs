import type { MedusaContainer } from "@medusajs/framework/types"
import {
  batchInventoryItemLevelsWorkflow,
  createProductVariantsWorkflow,
  createProductsWorkflow,
  deleteProductVariantsWorkflow,
  updateProductOptionsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
  uploadFilesWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"

import { KIBIGROUP_MODULE } from "../kibigroup"
import KibigroupModuleService from "../kibigroup/service"
import { HttpStatusException, ImportException } from "./errors"
import { slugify } from "./lib/slug"
import { compareMoney } from "./money"
import { mergePrices, PriceInput, PriceRow, pricesFor } from "./prices"
import { remoteGet } from "./remote-get"
import KibiimportModuleService from "./service"
import { ImportedProduct, ImportedVariant, ImportResult, StockResult } from "./types"

export const IMPORT_STOCK = 3

type Graph = {
  graph: (args: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data: Record<string, unknown>[] }>
}

type StoreContext = {
  currencyCodes: string[]
  defaultCurrency: string
  salesChannelIds: string[]
  shippingProfileId: string
  categoryName: string
}

type ProductOptionRow = {
  id: string
  title: string
  values: { value: string }[]
}

type VariantRow = {
  id: string
  barcode: string | null
  metadata: Record<string, unknown> | null
  prices: PriceRow[]
}

type ProductRow = {
  id: string
  metadata: Record<string, unknown> | null
  categoryIds: string[]
  options: ProductOptionRow[]
  variants: VariantRow[]
}

type WrittenCatalog = Omit<
  ImportResult,
  "currency" | "warnings" | "category" | "images" | "stock" | "colorUrls"
>

type DownloadedImage = {
  bytes: Buffer
  mediaType: string
}

export async function writeProduct(
  container: MedusaContainer,
  service: KibiimportModuleService,
  product: ImportedProduct,
  categoryId: string,
  locationIds: string[] = [],
  currencyCode: string | null = null
): Promise<ImportResult> {
  const color = product.color?.trim() ?? ""

  if (!color) {
    throw new ImportException("Ürünün rengi yok.")
  }

  const context = await loadContext(container, categoryId)
  const currency = pickCurrency(context, currencyCode)
  const warnings = currencyWarnings(product.currency, currency)
  const downloaded = await downloadImages(product.images)
  const imageUrls = await uploadImages(container, product.code, downloaded)
  const existingId = await findExistingProduct(container, service, product, color)
  const existing = existingId ? await loadProduct(container, existingId) : null

  if (existingId && !existing) {
    throw new ImportException("Kayıtlı ürün bulunamadı.")
  }

  const written = existing
    ? await updateCatalog(container, product, color, categoryId, currency, existing, imageUrls)
    : await createCatalog(container, product, color, categoryId, context, currency, imageUrls)

  await service.rememberProduct({
    source: product.source,
    code: product.code,
    color,
    product_id: written.productId,
  })
  await container
    .resolve<KibigroupModuleService>(KIBIGROUP_MODULE)
    .rememberImported(written.productId, product.code, color)

  const stock = await stockVariants(container, product, written.productId, locationIds)

  return {
    ...written,
    currency,
    warnings,
    category: context.categoryName,
    images: imageUrls.length,
    stock,
    colorUrls: product.colorUrls,
  }
}

/**
 * StockVariants links every variant to the chosen locations. A variant the
 * source still sells is raised to IMPORT_STOCK units. A sold out variant gets
 * a level with zero units and an existing level keeps its quantity.
 */
async function stockVariants(
  container: MedusaContainer,
  product: ImportedProduct,
  productId: string,
  locationIds: string[]
): Promise<StockResult> {
  if (!locationIds.length) {
    return { locations: [], stocked: 0, soldOut: 0 }
  }

  const query = graph(container)
  const [locations, variants] = await Promise.all([
    query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
      filters: { id: locationIds },
    }),
    query.graph({
      entity: "product_variant",
      fields: [
        "id",
        "barcode",
        "inventory_items.inventory_item_id",
        "inventory_items.inventory.location_levels.id",
        "inventory_items.inventory.location_levels.location_id",
        "inventory_items.inventory.location_levels.stocked_quantity",
      ],
      filters: { product_id: productId },
    }),
  ])
  const inStock = new Map(product.variants.map((variant) => [variant.barcode, variant.inStock]))
  const create: { inventory_item_id: string; location_id: string; stocked_quantity: number }[] = []
  const update: {
    id: string
    inventory_item_id: string
    location_id: string
    stocked_quantity: number
  }[] = []
  let stocked = 0
  let soldOut = 0

  for (const variant of variants.data) {
    const barcode = typeof variant.barcode === "string" ? variant.barcode : ""
    const items = asArray(variant.inventory_items).flatMap((link) => {
      const record = asRecord(link)
      const itemId = record?.inventory_item_id
      return typeof itemId === "string" ? [{ itemId, levels: levelsOf(record?.inventory) }] : []
    })

    if (!inStock.has(barcode) || !items.length) {
      continue
    }

    const available = inStock.get(barcode) === true

    if (available) {
      stocked += 1
    } else {
      soldOut += 1
    }

    for (const item of items) {
      for (const locationId of locationIds) {
        const level = item.levels.find((row) => row.locationId === locationId)

        if (!level) {
          create.push({
            inventory_item_id: item.itemId,
            location_id: locationId,
            stocked_quantity: available ? IMPORT_STOCK : 0,
          })
          continue
        }

        if (available && level.stockedQuantity < IMPORT_STOCK) {
          update.push({
            id: level.id,
            inventory_item_id: item.itemId,
            location_id: locationId,
            stocked_quantity: IMPORT_STOCK,
          })
        }
      }
    }
  }

  if (create.length || update.length) {
    await batchInventoryItemLevelsWorkflow(container).run({
      input: { create, update },
    })
  }

  const names = new Map(
    locations.data.flatMap((row): [string, string][] =>
      typeof row.id === "string" && typeof row.name === "string" ? [[row.id, row.name]] : []
    )
  )

  return {
    locations: locationIds.map((id) => names.get(id) ?? id),
    stocked,
    soldOut,
  }
}

function levelsOf(
  inventory: unknown
): { id: string; locationId: string; stockedQuantity: number }[] {
  return asArray(asRecord(inventory)?.location_levels).flatMap((level) => {
    const record = asRecord(level)
    const id = record?.id
    const locationId = record?.location_id
    const quantity = Number(record?.stocked_quantity ?? 0)

    if (typeof id !== "string" || typeof locationId !== "string") {
      return []
    }

    return [{ id, locationId, stockedQuantity: Number.isFinite(quantity) ? quantity : 0 }]
  })
}

async function loadContext(container: MedusaContainer, categoryId: string): Promise<StoreContext> {
  const query = graph(container)
  const [categories, channels, profiles, stores] = await Promise.all([
    query.graph({
      entity: "product_category",
      fields: ["id", "name"],
      filters: { id: categoryId },
    }),
    query.graph({
      entity: "sales_channel",
      fields: ["id"],
    }),
    query.graph({
      entity: "shipping_profile",
      fields: ["id"],
    }),
    query.graph({
      entity: "store",
      fields: ["id", "supported_currencies.currency_code", "supported_currencies.is_default"],
    }),
  ])

  const category = categories.data[0]
  const categoryName = typeof category?.name === "string" ? category.name : ""

  if (!category || !categoryName) {
    throw new ImportException("Kategori bulunamadı.")
  }

  const salesChannelIds = channels.data
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string")
  const shippingProfileId = profiles.data.find((row) => typeof row.id === "string")?.id

  if (!salesChannelIds.length || typeof shippingProfileId !== "string") {
    throw new ImportException("Satış kanalı veya gönderim profili bulunamadı.")
  }

  const currencies = stores.data.flatMap((store) =>
    asArray(store.supported_currencies).flatMap((currency) => {
      const record = asRecord(currency)
      const code = record?.currency_code
      return typeof code === "string" && code
        ? [{ code: code.toLowerCase(), isDefault: record?.is_default === true }]
        : []
    })
  )
  const currencyCodes = unique(currencies.map((currency) => currency.code))

  if (!currencyCodes.length) {
    throw new ImportException("Mağaza para birimi bulunamadı.")
  }

  return {
    currencyCodes,
    defaultCurrency:
      currencies.find((currency) => currency.isDefault)?.code ?? currencyCodes[0],
    salesChannelIds,
    shippingProfileId,
    categoryName,
  }
}

async function findExistingProduct(
  container: MedusaContainer,
  service: KibiimportModuleService,
  product: ImportedProduct,
  color: string
): Promise<string | null> {
  const link = await service.findProductLink(product.code, color)

  if (link) {
    await assertBarcodesBelong(container, product, link.product_id)
    return link.product_id
  }

  const owners = await barcodeOwners(container, product.variants.map((variant) => variant.barcode))
  const ownerIds = unique(owners.map((owner) => owner.productId))

  if (ownerIds.length > 1) {
    throw new ImportException(`Barkod ${owners[0]?.barcode ?? ""} başka bir ürüne ait.`)
  }

  if (!ownerIds.length) {
    return null
  }

  const ownerId = ownerIds[0]
  const ownerLink = await service.findProductLinkByProduct(ownerId)

  if (ownerLink && (ownerLink.code !== product.code || ownerLink.color !== color)) {
    throw new ImportException(`Barkod ${owners[0]?.barcode ?? ""} başka bir ürüne ait.`)
  }

  return ownerId
}

async function assertBarcodesBelong(
  container: MedusaContainer,
  product: ImportedProduct,
  productId: string
): Promise<void> {
  const owners = await barcodeOwners(container, product.variants.map((variant) => variant.barcode))

  for (const owner of owners) {
    if (owner.productId !== productId) {
      throw new ImportException(`Barkod ${owner.barcode} başka bir ürüne ait.`)
    }
  }
}

async function barcodeOwners(
  container: MedusaContainer,
  barcodes: string[]
): Promise<{ barcode: string; productId: string }[]> {
  if (!barcodes.length) {
    return []
  }

  const { data } = await graph(container).graph({
    entity: "product_variant",
    fields: ["barcode", "product_id"],
    filters: { barcode: barcodes },
  })

  return data.flatMap((row) => {
    const barcode = typeof row.barcode === "string" ? row.barcode : ""
    const productId = typeof row.product_id === "string" ? row.product_id : ""

    if (!barcode || !productId) {
      return []
    }

    return [{ barcode, productId }]
  })
}

async function createCatalog(
  container: MedusaContainer,
  product: ImportedProduct,
  color: string,
  categoryId: string,
  context: StoreContext,
  currency: string,
  imageUrls: string[]
): Promise<WrittenCatalog> {
  const axis = axisName(product)
  const handle = await availableHandle(container, product, color)
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: product.name,
          handle,
          subtitle: product.brand ?? undefined,
          description: describe(product),
          status: ProductStatus.PUBLISHED,
          thumbnail: imageUrls[0],
          images: imageUrls.map((url) => ({ url })),
          shipping_profile_id: context.shippingProfileId,
          category_ids: [categoryId],
          sales_channels: context.salesChannelIds.map((id) => ({ id })),
          metadata: metadataOf(product, color),
          options: [{ title: axis, values: optionValues(product, axis) }],
          variants: product.variants.map((variant) =>
            variantInput(product, variant, axis, pricesFor(variant.price, currency))
          ),
        },
      ],
    },
  })

  const created = result[0]

  if (!created?.id) {
    throw new ImportException("Ürün kaydedilemedi.")
  }

  return {
    productId: created.id,
    code: product.code,
    name: product.name,
    created: true,
    createdVariants: product.variants.length,
    updatedVariants: 0,
    removedVariants: 0,
  }
}

async function updateCatalog(
  container: MedusaContainer,
  product: ImportedProduct,
  color: string,
  categoryId: string,
  currency: string,
  existing: ProductRow,
  imageUrls: string[]
): Promise<WrittenCatalog> {
  const counts = await syncVariants(container, product, existing, currency)

  await updateProductsWorkflow(container).run({
    input: {
      products: [
        {
          id: existing.id,
          title: product.name,
          subtitle: product.brand ?? undefined,
          description: describe(product),
          thumbnail: imageUrls[0] ?? null,
          images: imageUrls.map((url) => ({ url })),
          category_ids: unique([...existing.categoryIds, categoryId]),
          metadata: {
            ...(existing.metadata ?? {}),
            ...metadataOf(product, color),
          },
        },
      ],
    },
  })

  return {
    productId: existing.id,
    code: product.code,
    name: product.name,
    created: false,
    ...counts,
  }
}

async function syncVariants(
  container: MedusaContainer,
  product: ImportedProduct,
  existing: ProductRow,
  currency: string
): Promise<{ createdVariants: number; updatedVariants: number; removedVariants: number }> {
  if (existing.options.length !== 1) {
    throw new ImportException("Ürünün varyant seçeneği içe aktarmayla güncellenemiyor.")
  }

  const axis = axisName(product)
  const option = existing.options[0]
  const desired = optionValues(product, axis)
  const currentValues = option.values.map((value) => value.value)
  const union = unique([...currentValues, ...desired])

  if (option.title !== axis || union.length !== currentValues.length || union.some((value) => !currentValues.includes(value))) {
    await updateProductOptionsWorkflow(container).run({
      input: {
        selector: { id: option.id },
        update: { title: axis, values: union },
      },
    })
  }

  const byBarcode = new Map(
    existing.variants.filter((variant) => variant.barcode).map((variant) => [variant.barcode as string, variant])
  )
  const kept = new Set<string>()
  const creating: (ReturnType<typeof variantInput> & {
    product_id: string
    manage_inventory: boolean
  })[] = []
  const updating: ({ id: string } & ReturnType<typeof variantInput>)[] = []

  for (const variant of product.variants) {
    const current = byBarcode.get(variant.barcode)

    if (!current) {
      const next = variantInput(product, variant, axis, pricesFor(variant.price, currency))
      creating.push({ ...next, product_id: existing.id, manage_inventory: true })
      continue
    }

    kept.add(current.id)
    const prices = mergePrices(current.prices, variant.price, currency)
    updating.push({ id: current.id, ...variantInput(product, variant, axis, prices, current.metadata) })
  }

  if (creating.length) {
    await createProductVariantsWorkflow(container).run({
      input: { product_variants: creating },
    })
  }

  const priced = updating.filter((variant) => variant.prices?.length)
  const unpriced = updating.filter((variant) => !variant.prices?.length)

  if (priced.length) {
    await updateProductVariantsWorkflow(container).run({
      input: { product_variants: priced },
    })
  }

  if (unpriced.length) {
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: unpriced.map(({ prices: _prices, ...variant }) => variant),
      },
    })
    await upsertVariantPricesWorkflow(container).run({
      input: {
        variantPrices: [],
        previousVariantIds: unpriced.map((variant) => variant.id),
      },
    })
  }

  const removed = existing.variants.map((variant) => variant.id).filter((id) => !kept.has(id))

  if (removed.length) {
    await deleteProductVariantsWorkflow(container).run({
      input: { ids: removed },
    })
  }

  if (desired.length !== union.length) {
    await updateProductOptionsWorkflow(container).run({
      input: {
        selector: { id: option.id },
        update: { values: desired },
      },
    })
  }

  return {
    createdVariants: creating.length,
    updatedVariants: updating.length,
    removedVariants: removed.length,
  }
}

function variantInput(
  product: ImportedProduct,
  variant: ImportedVariant,
  axis: string,
  prices: PriceInput[] | undefined,
  metadata: Record<string, unknown> | null = null
) {
  const value = optionValue(variant, axis)
  const compareAt =
    variant.compareAtPrice &&
    variant.price &&
    compareMoney(variant.compareAtPrice, variant.price) > 0
      ? variant.compareAtPrice
      : null

  return {
    title: value,
    sku: variant.barcode,
    barcode: variant.barcode,
    options: { [axis]: value },
    ...(prices?.length ? { prices } : {}),
    metadata: {
      ...(metadata ?? {}),
      compare_at_price: compareAt,
      item_number: variant.sku,
      tax_rate: product.taxRate,
    },
  }
}

async function loadProduct(container: MedusaContainer, id: string): Promise<ProductRow | null> {
  const { data } = await graph(container).graph({
    entity: "product",
    fields: [
      "id",
      "metadata",
      "categories.id",
      "options.id",
      "options.title",
      "options.values.value",
      "variants.id",
      "variants.barcode",
      "variants.metadata",
      "variants.prices.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.prices.min_quantity",
      "variants.prices.max_quantity",
      "variants.prices.price_list_id",
      "variants.prices.price_rules.attribute",
      "variants.prices.price_rules.value",
    ],
    filters: { id },
  })
  const row = data[0]

  if (!row || typeof row.id !== "string") {
    return null
  }

  return {
    id: row.id,
    metadata: asRecord(row.metadata),
    categoryIds: asArray(row.categories).flatMap((category) => {
      const idValue = asRecord(category)?.id
      return typeof idValue === "string" ? [idValue] : []
    }),
    options: asArray(row.options).flatMap((option) => {
      const record = asRecord(option)
      const idValue = record?.id
      const title = record?.title

      if (typeof idValue !== "string" || typeof title !== "string") {
        return []
      }

      return [
        {
          id: idValue,
          title,
          values: asArray(record?.values).flatMap((value) => {
            const text = asRecord(value)?.value
            return typeof text === "string" ? [{ value: text }] : []
          }),
        },
      ]
    }),
    variants: asArray(row.variants).flatMap((variant) => {
      const record = asRecord(variant)

      if (!record || typeof record.id !== "string") {
        return []
      }

      return [
        {
          id: record.id,
          barcode: typeof record.barcode === "string" ? record.barcode : null,
          metadata: asRecord(record.metadata),
          prices: priceRowsOf(record.prices),
        },
      ]
    }),
  }
}

/**
 * PriceRowsOf skips price list prices. Medusa never replaces those when a
 * variant's prices are updated.
 */
function priceRowsOf(value: unknown): PriceRow[] {
  return asArray(value).flatMap((price) => {
    const record = asRecord(price)
    const amount = Number(record?.amount)

    if (
      !record ||
      typeof record.id !== "string" ||
      typeof record.currency_code !== "string" ||
      record.price_list_id ||
      !Number.isFinite(amount)
    ) {
      return []
    }

    return [
      {
        id: record.id,
        amount,
        currency_code: record.currency_code.toLowerCase(),
        min_quantity: numberOrNull(record.min_quantity),
        max_quantity: numberOrNull(record.max_quantity),
        rules: Object.fromEntries(
          asArray(record.price_rules).flatMap((rule) => {
            const row = asRecord(rule)
            return typeof row?.attribute === "string" && typeof row.value === "string"
              ? [[row.attribute, row.value]]
              : []
          })
        ),
      },
    ]
  })
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

async function availableHandle(
  container: MedusaContainer,
  product: ImportedProduct,
  color: string
): Promise<string> {
  const base = `${slugify(product.code)}-${slugify(color)}`.slice(0, 100)
  const withId = `${base}-${slugify(product.externalId)}`.slice(0, 120)

  if (!(await handleExists(container, base))) {
    return base
  }

  if (!(await handleExists(container, withId))) {
    return withId
  }

  return `${withId}-${Date.now()}`.slice(0, 140)
}

async function handleExists(container: MedusaContainer, handle: string): Promise<boolean> {
  const { data } = await graph(container).graph({
    entity: "product",
    fields: ["id"],
    filters: { handle },
  })

  return data.length > 0
}

async function downloadImages(urls: string[]): Promise<DownloadedImage[]> {
  const images: DownloadedImage[] = []

  for (const url of urls) {
    const response = await remoteGet(url, "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")

    if (response.status < 200 || response.status >= 300) {
      throw new HttpStatusException(
        response.status,
        `Ürün görseli için HTTP ${response.status} döndü: ${url}`
      )
    }

    if (!response.mediaType.startsWith("image/")) {
      throw new ImportException(`Ürün görseli indirilemedi: ${url}`)
    }

    images.push({ bytes: response.body, mediaType: response.mediaType })
  }

  return images
}

async function uploadImages(
  container: MedusaContainer,
  code: string,
  images: DownloadedImage[]
): Promise<string[]> {
  if (!images.length) {
    return []
  }

  const slug = slugify(code)
  const { result } = await uploadFilesWorkflow(container).run({
    input: {
      files: images.map((image, index) => ({
        filename: `${slug}-${index + 1}.${extension(image.mediaType)}`,
        mimeType: image.mediaType,
        content: image.bytes.toString("base64"),
        access: "public" as const,
      })),
    },
  })

  return result.map((file) => file.url)
}

function axisName(product: ImportedProduct): string {
  for (const variant of product.variants) {
    const name = variant.attributes[0]?.name

    if (name) {
      return name
    }
  }

  return "Seçenek"
}

function optionValues(product: ImportedProduct, axis: string): string[] {
  return unique(product.variants.map((variant) => optionValue(variant, axis)))
}

function optionValue(variant: ImportedVariant, axis: string): string {
  return variant.attributes.find((attribute) => attribute.name === axis)?.value || "Standart"
}

function pickCurrency(context: StoreContext, code: string | null): string {
  if (!code) {
    return context.defaultCurrency
  }

  const currency = code.toLowerCase()

  if (!context.currencyCodes.includes(currency)) {
    throw new ImportException(`${currency.toUpperCase()} para birimi mağazada tanımlı değil.`)
  }

  return currency
}


function describe(product: ImportedProduct): string {
  const lines: string[] = []

  if (product.brand) {
    lines.push(`Marka: ${product.brand}`)
  }

  if (product.color) {
    lines.push(`Renk: ${product.color}`)
  }

  for (const attribute of product.attributes) {
    lines.push(`${attribute.name}: ${attribute.value}`)
  }

  return lines.join("\n")
}

function metadataOf(product: ImportedProduct, color: string): Record<string, unknown> {
  return {
    kibiimport: {
      source: product.source,
      external_id: product.externalId,
      code: product.code,
      color,
      brand: product.brand,
      tax_rate: product.taxRate,
      locale: product.locale,
      currency: product.currency,
      attributes: product.attributes,
    },
  }
}

function currencyWarnings(source: string | null, currency: string): string[] {
  if (!source || source.toLowerCase() === currency) {
    return []
  }

  return [
    `Kaynak fiyat ${source.toUpperCase()}, kayıt ${currency.toUpperCase()}. Sayı kur çevrimi yapılmadan yazıldı.`,
  ]
}

function extension(mediaType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  }

  return extensions[mediaType] ?? "jpg"
}

function graph(container: MedusaContainer): Graph {
  return container.resolve(ContainerRegistrationKeys.QUERY) as Graph
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
