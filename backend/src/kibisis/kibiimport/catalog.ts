import type { MedusaContainer } from "@medusajs/framework/types"
import {
  batchInventoryItemLevelsWorkflow,
  createProductVariantsWorkflow,
  createProductsWorkflow,
  deleteProductVariantsWorkflow,
  updateProductOptionsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"

import { KIBIGROUP_MODULE } from "../kibigroup"
import KibigroupModuleService from "../kibigroup/service"
import { ImportException } from "./errors"
import {
  deleteImages,
  downloadImages,
  sameSources,
  StoredImages,
  storedImagesOf,
  UploadedImages,
  uploadImages,
} from "./images"
import { slugify } from "./lib/slug"
import { compareMoney } from "./money"
import { mergePrices, PriceInput, PriceRow, pricesFor } from "./prices"
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
  "currency" | "warnings" | "category" | "images" | "imagesKept" | "stock" | "colorUrls"
>

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
  const existingId = await findExistingProduct(container, service, product, color)
  const existing = existingId ? await loadProduct(container, existingId) : null

  if (existingId && !existing) {
    throw new ImportException("Kayıtlı ürün bulunamadı.")
  }

  const previous = storedImagesOf(existing?.metadata)
  const kept = previous && sameSources(previous.sources, product.images) ? previous : null
  const uploaded = kept
    ? null
    : await uploadImages(container, product.code, await downloadImages(product.images))
  const stored: StoredImages = kept ?? { sources: product.images, keys: uploaded?.keys ?? [] }

  let written: WrittenCatalog

  try {
    written = existing
      ? await updateCatalog(container, product, color, categoryId, currency, existing, uploaded, stored)
      : await createCatalog(container, product, color, categoryId, context, currency, uploaded, stored)
  } catch (error) {
    await deleteImages(container, uploaded?.keys ?? [])
    throw error
  }

  if (uploaded && previous) {
    await deleteImages(
      container,
      previous.keys.filter((key) => !uploaded.keys.includes(key))
    )
  }

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
    images: stored.keys.length,
    imagesKept: kept !== null,
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

  if (link && (await productExists(container, link.product_id))) {
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

async function productExists(container: MedusaContainer, id: string): Promise<boolean> {
  const { data } = await graph(container).graph({
    entity: "product",
    fields: ["id"],
    filters: { id },
  })

  return data.length > 0
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
  uploaded: UploadedImages | null,
  stored: StoredImages
): Promise<WrittenCatalog> {
  const axes = axisNames(product)
  const handle = await availableHandle(container, product, color)
  const imageUrls = uploaded?.urls ?? []
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
          metadata: metadataOf(product, color, stored),
          options: axes.map((axis) => ({ title: axis, values: optionValues(product, axis) })),
          variants: product.variants.map((variant) =>
            variantInput(product, variant, axes, pricesFor(variant.price, currency))
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
  uploaded: UploadedImages | null,
  stored: StoredImages
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
          ...(uploaded
            ? {
                thumbnail: uploaded.urls[0] ?? null,
                images: uploaded.urls.map((url) => ({ url })),
              }
            : {}),
          category_ids: unique([...existing.categoryIds, categoryId]),
          metadata: {
            ...(existing.metadata ?? {}),
            ...metadataOf(product, color, stored),
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
  const axes = axisNames(product)

  if (existing.options.length !== axes.length) {
    throw new ImportException(
      `Ürünün ${existing.options.length} varyant seçeneği var, kaynakta ${axes.length}. Ürünü silip yeniden içe aktarın.`
    )
  }

  const pairs = pairOptions(existing.options, axes)

  for (const { option, axis } of pairs) {
    const currentValues = option.values.map((value) => value.value)
    const union = unique([...currentValues, ...optionValues(product, axis)])

    if (option.title !== axis || union.length !== currentValues.length) {
      await updateProductOptionsWorkflow(container).run({
        input: {
          selector: { id: option.id },
          update: { title: axis, values: union },
        },
      })
    }
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
      const next = variantInput(product, variant, axes, pricesFor(variant.price, currency))
      creating.push({ ...next, product_id: existing.id, manage_inventory: true })
      continue
    }

    kept.add(current.id)
    const prices = mergePrices(current.prices, variant.price, currency)
    updating.push({ id: current.id, ...variantInput(product, variant, axes, prices, current.metadata) })
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

  for (const { option, axis } of pairs) {
    const desired = optionValues(product, axis)
    const union = unique([...option.values.map((value) => value.value), ...desired])

    if (desired.length !== union.length) {
      await updateProductOptionsWorkflow(container).run({
        input: {
          selector: { id: option.id },
          update: { values: desired },
        },
      })
    }
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
  axes: string[],
  prices: PriceInput[] | undefined,
  metadata: Record<string, unknown> | null = null
) {
  const values = axes.map((axis) => optionValue(variant, axis))
  const compareAt =
    variant.compareAtPrice &&
    variant.price &&
    compareMoney(variant.compareAtPrice, variant.price) > 0
      ? variant.compareAtPrice
      : null

  return {
    title: values.join(" / "),
    sku: variant.barcode,
    barcode: variant.barcode,
    options: Object.fromEntries(axes.map((axis, index) => [axis, values[index]])),
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

function axisNames(product: ImportedProduct): string[] {
  const names = unique(
    product.variants.flatMap((variant) => variant.attributes.map((attribute) => attribute.name)).filter(Boolean)
  )

  return names.length ? names : ["Seçenek"]
}

/**
 * PairOptions matches the stored options to the source axes by title. An
 * option whose title the source renamed takes the next axis left over.
 */
function pairOptions(
  options: ProductOptionRow[],
  axes: string[]
): { option: ProductOptionRow; axis: string }[] {
  const left = [...options]
  const pairs: { option: ProductOptionRow; axis: string }[] = []
  const unmatched: string[] = []

  for (const axis of axes) {
    const index = left.findIndex((option) => option.title === axis)

    if (index >= 0) {
      pairs.push({ option: left.splice(index, 1)[0] as ProductOptionRow, axis })
    } else {
      unmatched.push(axis)
    }
  }

  unmatched.forEach((axis, index) => {
    const option = left[index]

    if (option) {
      pairs.push({ option, axis })
    }
  })

  return pairs
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

function metadataOf(
  product: ImportedProduct,
  color: string,
  images: StoredImages
): Record<string, unknown> {
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
      image_sources: images.sources,
      image_keys: images.keys,
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
