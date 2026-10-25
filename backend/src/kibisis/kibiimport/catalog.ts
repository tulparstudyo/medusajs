import type { MedusaContainer } from "@medusajs/framework/types"
import {
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
import { ImportException } from "./errors"
import { slugify } from "./lib/slug"
import { compareMoney } from "./money"
import { remoteGet } from "./remote-get"
import KibiimportModuleService from "./service"
import { ImportedProduct, ImportedVariant, ImportResult } from "./types"

type Graph = {
  graph: (args: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data: Record<string, unknown>[] }>
}

type StoreContext = {
  currencyCodes: string[]
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
}

type ProductRow = {
  id: string
  metadata: Record<string, unknown> | null
  categoryIds: string[]
  options: ProductOptionRow[]
  variants: VariantRow[]
}

type DownloadedImage = {
  bytes: Buffer
  mediaType: string
}

export async function writeProduct(
  container: MedusaContainer,
  service: KibiimportModuleService,
  product: ImportedProduct,
  categoryId: string
): Promise<ImportResult> {
  const color = product.color?.trim() ?? ""

  if (!color) {
    throw new ImportException("Ürünün rengi yok.")
  }

  const context = await loadContext(container, categoryId)
  const warnings = currencyWarnings(product.currency, context.currencyCodes)
  const downloaded = await downloadImages(product.images)
  const imageUrls = await uploadImages(container, product.code, downloaded)
  const existingId = await findExistingProduct(container, service, product, color)
  const existing = existingId ? await loadProduct(container, existingId) : null

  if (existingId && !existing) {
    throw new ImportException("Kayıtlı ürün bulunamadı.")
  }

  const written = existing
    ? await updateCatalog(container, product, color, categoryId, context, existing, imageUrls)
    : await createCatalog(container, product, color, categoryId, context, imageUrls)

  await service.rememberProduct({
    source: product.source,
    code: product.code,
    color,
    product_id: written.productId,
  })
  await container
    .resolve<KibigroupModuleService>(KIBIGROUP_MODULE)
    .rememberImported(written.productId, product.code, color)

  return {
    ...written,
    warnings,
    category: context.categoryName,
    images: imageUrls.length,
  }
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
      fields: ["id", "supported_currencies.currency_code"],
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

  const currencyCodes = unique(
    stores.data.flatMap((store) => {
      const currencies = store.supported_currencies
      if (!Array.isArray(currencies)) {
        return []
      }

      return currencies
        .map((currency) => {
          if (!currency || typeof currency !== "object") {
            return ""
          }

          const code = (currency as { currency_code?: unknown }).currency_code
          return typeof code === "string" ? code.toLowerCase() : ""
        })
        .filter((code) => code !== "")
    })
  )

  if (!currencyCodes.length) {
    throw new ImportException("Mağaza para birimi bulunamadı.")
  }

  return {
    currencyCodes,
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
  imageUrls: string[]
): Promise<Omit<ImportResult, "warnings" | "category" | "images">> {
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
            variantInput(product, variant, axis, context.currencyCodes)
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
  context: StoreContext,
  existing: ProductRow,
  imageUrls: string[]
): Promise<Omit<ImportResult, "warnings" | "category" | "images">> {
  const counts = await syncVariants(container, product, existing, context.currencyCodes)

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
  currencyCodes: string[]
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
    const next = variantInput(product, variant, axis, currencyCodes, current?.metadata)

    if (!current) {
      creating.push({ ...next, product_id: existing.id, manage_inventory: true })
      continue
    }

    kept.add(current.id)
    updating.push({ id: current.id, ...next })
  }

  if (creating.length) {
    await createProductVariantsWorkflow(container).run({
      input: { product_variants: creating },
    })
  }

  const priced = updating.filter((variant) => variant.prices)
  const unpriced = updating.filter((variant) => !variant.prices)

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
  currencyCodes: string[],
  metadata: Record<string, unknown> | null = null
) {
  const value = optionValue(variant, axis)
  const prices = pricesFor(variant.price, currencyCodes)
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
    ...(prices ? { prices } : {}),
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
        },
      ]
    }),
  }
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

    if (response.status < 200 || response.status >= 300 || !response.mediaType.startsWith("image/")) {
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

function pricesFor(amount: string | null, currencyCodes: string[]) {
  if (!amount) {
    return undefined
  }

  const value = Number(amount)

  return currencyCodes.map((currency_code) => ({
    amount: value,
    currency_code,
  }))
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

function currencyWarnings(currency: string | null, codes: string[]): string[] {
  if (!currency) {
    return []
  }

  return codes
    .filter((code) => code.toUpperCase() !== currency.toUpperCase())
    .map(
      (code) =>
        `Kaynak fiyat ${currency} ve mağaza ${code.toUpperCase()} kullanıyor. Sayı olduğu gibi kaydedildi.`
    )
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
