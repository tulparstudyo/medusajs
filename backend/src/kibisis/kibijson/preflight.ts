import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

import { KIBIIMPORT_MODULE } from "../kibiimport"
import { ImportException } from "../kibiimport/errors"
import { assertProduct } from "../kibiimport/importer"
import KibiimportModuleService from "../kibiimport/service"
import { adaptProduct, colorOf } from "./adapter"
import { sha256, stableJson } from "./hash"
import { checkLocalImage, imageSourceOf } from "./local-images"
import { Envelope, EnvelopeSchema, issueLines, ProductDocumentSchema } from "./schema"
import { NewItem } from "./service"
import { loadCategoryIndex, resolveCategories } from "./taxonomy"
import { matchLocale, storeLocales } from "./translations"
import { PreflightReport, ReportLine } from "./types"

const MAX_REPORT_LINES = 2000
const BARCODE_CHUNK = 500

type Graph = {
  graph: (args: { entity: string; fields: string[]; filters?: Record<string, unknown> }) => Promise<{
    data: Record<string, unknown>[]
  }>
}

export type Preflight = {
  envelope: Envelope
  payloadSha256: string
  imageBase: string | null
  items: NewItem[]
  report: PreflightReport
}

type Draft = {
  item: NewItem
  barcodes: string[]
}

/**
 * RunPreflight reads a document without writing to the catalog. Every
 * product becomes an item; one that cannot be imported is skipped with the
 * reason, so a single bad row never rejects the whole file.
 */
export async function runPreflight(
  container: MedusaContainer,
  document: unknown,
  imageBaseOverride?: string | null
): Promise<Preflight> {
  const parsedEnvelope = EnvelopeSchema.safeParse(document)

  if (!parsedEnvelope.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, issueLines(parsedEnvelope.error).slice(0, 20).join("\n"))
  }

  const envelope = parsedEnvelope.data
  const imageBase = (imageBaseOverride !== undefined ? imageBaseOverride : envelope.image_base) || null
  const [categories, locales, currencies] = await Promise.all([
    loadCategoryIndex(container),
    storeLocales(container),
    storeCurrencies(container),
  ])
  const report: PreflightReport = {
    products: envelope.products.length,
    variants: 0,
    images: { local: 0, remote: 0, missing: 0 },
    ready: 0,
    invalid: 0,
    needs_category: 0,
    lines: [],
  }
  const drafts: Draft[] = []
  const keys = new Set<string>()

  for (const [index, raw] of envelope.products.entries()) {
    const position = index + 1
    const payload = withDefaults(raw, envelope)
    const errors: string[] = []
    const warnings: string[] = []
    let code = textOf(raw.code) || `#${position}`
    let color = colorText(raw.color) || `#${position}`
    let title = textOf(raw.title) || code
    let externalId = textOf(raw.external_id) || code
    let categoryIds: string[] = []
    let barcodes: string[] = []
    const parsed = ProductDocumentSchema.safeParse(payload)

    if (!parsed.success) {
      errors.push(...issueLines(parsed.error))
    } else {
      const product = parsed.data
      const adapted = adaptProduct(product, envelope.source)
      code = product.code
      color = colorOf(product).name
      title = product.title
      externalId = product.external_id
      barcodes = product.variants.map((variant) => variant.barcode)
      report.variants += product.variants.length

      try {
        assertProduct(adapted.product)
      } catch (error) {
        errors.push(error instanceof ImportException ? error.message : String(error))
      }

      const unknownCurrencies = [
        ...new Set(
          product.variants.flatMap((variant) => variant.prices.map((price) => price.currency_code))
        ),
      ].filter((currency) => !currencies.includes(currency))

      if (unknownCurrencies.length) {
        errors.push(
          `${unknownCurrencies.map((currency) => currency.toUpperCase()).join(", ")} para birimi mağazada tanımlı değil.`
        )
      }

      if (!product.variants.some((variant) => variant.prices.length)) {
        warnings.push("Hiçbir varyantta fiyat yok.")
      }

      for (const entry of adapted.images ?? []) {
        const source = imageSourceOf(entry)

        if (source.kind === "remote") {
          report.images.remote += 1
          continue
        }

        report.images.local += 1
        const check = await checkLocalImage(imageBase, source.path)

        if (!check.ok) {
          report.images.missing += 1
          errors.push(check.message)
        } else if (check.busy) {
          warnings.push(`Görsel hâlâ yükleniyor olabilir: ${entry}`)
        }
      }

      if (adapted.images === null) {
        warnings.push("images alanı yok: ürün güncellenirse mevcut görselleri korunur.")
      }

      const resolved = resolveCategories(categories, adapted.categories)
      categoryIds = resolved.value
      warnings.push(...resolved.warnings)

      for (const key of Object.keys(adapted.translations)) {
        if (!matchLocale(key, locales)) {
          warnings.push(`Çeviri dili mağazada tanımlı değil: ${key}`)
        }
      }
    }

    const key = `${code}\u0000${color.toLocaleLowerCase("tr-TR")}`

    if (keys.has(key)) {
      errors.push(`Aynı kod ve renk dosyada daha önce geçti: ${code} / ${color}`)
      color = `${color} #${position}`
    }

    keys.add(`${code}\u0000${color.toLocaleLowerCase("tr-TR")}`)
    drafts.push({
      item: {
        position,
        external_id: externalId.slice(0, 200),
        code: code.slice(0, 120),
        color: color.slice(0, 120),
        title: title.slice(0, 500),
        payload,
        payload_sha256: sha256(stableJson({ source: envelope.source, image_base: imageBase, payload })),
        category_ids: categoryIds,
        status: errors.length ? "skipped" : "pending",
        error: errors.length ? errors.join("\n") : null,
        warnings,
      },
      barcodes: errors.length ? [] : barcodes,
    })
  }

  await checkBarcodes(container, drafts)

  for (const { item } of drafts) {
    if (item.status === "pending") {
      report.ready += 1

      if (!item.category_ids.length) {
        report.needs_category += 1
      }
    } else {
      report.invalid += 1
    }

    pushLines(report.lines, item, "error", item.error ? item.error.split("\n") : [])
    pushLines(report.lines, item, "warning", item.warnings)
  }

  return {
    envelope,
    payloadSha256: sha256(stableJson({ document, image_base: imageBase })),
    imageBase,
    items: drafts.map((draft) => draft.item),
    report,
  }
}

/**
 * CheckBarcodes refuses a barcode used twice in the file, or one that
 * belongs to a product imported under another code or colour.
 */
async function checkBarcodes(container: MedusaContainer, drafts: Draft[]): Promise<void> {
  const owners = new Map<string, Draft>()

  for (const draft of drafts) {
    for (const barcode of draft.barcodes) {
      const owner = owners.get(barcode)

      if (owner && owner !== draft) {
        fail(draft, `Barkod ${barcode} dosyada ${owner.item.position}. üründe de var.`)
      } else {
        owners.set(barcode, draft)
      }
    }
  }

  const barcodes = [...owners.keys()]

  if (!barcodes.length) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as Graph
  const service = container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService
  const productOf = new Map<string, string>()

  for (let start = 0; start < barcodes.length; start += BARCODE_CHUNK) {
    const { data } = await query.graph({
      entity: "product_variant",
      fields: ["barcode", "product_id"],
      filters: { barcode: barcodes.slice(start, start + BARCODE_CHUNK) },
    })

    for (const row of data) {
      if (typeof row.barcode === "string" && typeof row.product_id === "string") {
        productOf.set(row.barcode, row.product_id)
      }
    }
  }

  const productIds = [...new Set(productOf.values())]
  const links = new Map<string, { code: string; color: string }>()

  for (let start = 0; start < productIds.length; start += BARCODE_CHUNK) {
    const rows = await service.listImportProducts(
      { product_id: productIds.slice(start, start + BARCODE_CHUNK) },
      { take: BARCODE_CHUNK }
    )

    for (const row of rows) {
      links.set(row.product_id, { code: row.code, color: row.color })
    }
  }

  for (const [barcode, productId] of productOf) {
    const draft = owners.get(barcode)
    const link = links.get(productId)

    if (draft && draft.item.status === "pending" && link) {
      if (link.code !== draft.item.code || link.color !== draft.item.color) {
        fail(draft, `Barkod ${barcode} başka bir ürüne ait (${link.code} / ${link.color}).`)
      }
    }
  }
}

async function storeCurrencies(container: MedusaContainer): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as Graph
  const { data } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  })

  return data.flatMap((store) =>
    (Array.isArray(store.supported_currencies) ? store.supported_currencies : []).flatMap(
      (currency: { currency_code?: unknown }) =>
        typeof currency?.currency_code === "string" ? [currency.currency_code.toLowerCase()] : []
    )
  )
}

function fail(draft: Draft, message: string): void {
  draft.item.status = "skipped"
  draft.item.error = draft.item.error ? `${draft.item.error}\n${message}` : message
}

/** WithDefaults fills locale and currency from the document defaults, so an item stands alone. */
function withDefaults(raw: Record<string, unknown>, envelope: Envelope): Record<string, unknown> {
  return {
    ...(envelope.defaults?.locale ? { locale: envelope.defaults.locale } : {}),
    ...(envelope.defaults?.currency ? { currency: envelope.defaults.currency } : {}),
    ...raw,
  }
}

function pushLines(lines: ReportLine[], item: NewItem, level: ReportLine["level"], messages: string[]): void {
  for (const message of messages) {
    if (lines.length >= MAX_REPORT_LINES) {
      return
    }

    lines.push({ position: item.position, code: item.code, color: item.color, level, message })
  }
}

function textOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
}

function colorText(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return textOf((value as Record<string, unknown>).name)
  }

  return textOf(value)
}
