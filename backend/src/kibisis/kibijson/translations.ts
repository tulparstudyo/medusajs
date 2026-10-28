import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { batchTranslationsWorkflow } from "@medusajs/medusa/core-flows"

import { Translations } from "./adapter"

type Row = Record<string, unknown>

type Graph = {
  graph: (args: { entity: string; fields: string[]; filters?: Record<string, unknown> }) => Promise<{
    data: Row[]
  }>
}

type TranslationRecord = {
  id: string
  reference_id: string
  reference: string
  locale_code: string
  translations: Record<string, unknown> | null
}

type TranslationService = {
  listTranslations: (
    filters: Record<string, unknown>,
    config?: { take?: number }
  ) => Promise<TranslationRecord[]>
}

type Entry = { reference: string; referenceId: string; texts: Record<string, string> }

export async function storeLocales(container: MedusaContainer): Promise<string[]> {
  const { data } = await graph(container).graph({
    entity: "store",
    fields: ["id", "supported_locales.locale_code"],
  })

  return [
    ...new Set(
      data.flatMap((store) =>
        asArray(store.supported_locales).flatMap((locale) => {
          const code = asRecord(locale)?.locale_code
          return typeof code === "string" && code ? [code] : []
        })
      )
    ),
  ]
}

/** MatchLocale reads "en" as the store's first English locale and "en-US" as itself. */
export function matchLocale(key: string, locales: string[]): string | null {
  const wanted = key.trim().toLowerCase()
  const exact = locales.find((locale) => locale.toLowerCase() === wanted)

  if (exact) {
    return exact
  }

  const language = wanted.split("-")[0]
  return locales.find((locale) => locale.toLowerCase().split("-")[0] === language) ?? null
}

/**
 * WriteTranslations saves the document's translations of the product, its
 * options, option values and variants. Texts the document does not give
 * stay as they are. A failure is reported, the product is already saved.
 */
export async function writeTranslations(
  container: MedusaContainer,
  productId: string,
  translations: Translations
): Promise<string[]> {
  const keys = Object.keys(translations)

  if (!keys.length) {
    return []
  }

  try {
    const locales = await storeLocales(container)
    const warnings: string[] = []
    const { data } = await graph(container).graph({
      entity: "product",
      fields: [
        "id",
        "options.id",
        "options.title",
        "options.values.id",
        "options.values.value",
        "variants.id",
        "variants.barcode",
      ],
      filters: { id: productId },
    })
    const product = data[0]
    const byLocale = new Map<string, Entry[]>()

    for (const key of keys) {
      const locale = matchLocale(key, locales)

      if (!locale) {
        warnings.push(`Çeviri dili mağazada tanımlı değil: ${key}`)
        continue
      }

      byLocale.set(locale, entriesOf(productId, product, translations[key]))
    }

    const service = container.resolve(Modules.TRANSLATION) as TranslationService
    const create: { reference_id: string; reference: string; locale_code: string; translations: Record<string, string> }[] = []
    const update: { id: string; translations: Record<string, unknown> }[] = []

    for (const [locale, entries] of byLocale) {
      const ids = [...new Set(entries.map((entry) => entry.referenceId))]

      if (!ids.length) {
        continue
      }

      const existing = await service.listTranslations(
        { reference_id: ids, locale_code: locale },
        { take: ids.length * 4 }
      )

      for (const entry of entries) {
        const current = existing.find(
          (row) => row.reference_id === entry.referenceId && row.reference === entry.reference
        )

        if (current) {
          update.push({ id: current.id, translations: { ...(current.translations ?? {}), ...entry.texts } })
        } else {
          create.push({
            reference_id: entry.referenceId,
            reference: entry.reference,
            locale_code: locale,
            translations: entry.texts,
          })
        }
      }
    }

    if (create.length || update.length) {
      await batchTranslationsWorkflow(container).run({ input: { create, update, delete: [] } })
    }

    return warnings
  } catch (error) {
    return [`Çeviriler kaydedilemedi: ${(error as Error).message}`]
  }
}

function entriesOf(productId: string, product: Row | undefined, translation: Translations[string]): Entry[] {
  const entries: Entry[] = []
  const push = (reference: string, referenceId: string, texts: Record<string, string | null | undefined>) => {
    const clean = Object.fromEntries(
      Object.entries(texts).flatMap(([field, value]) =>
        typeof value === "string" && value.trim() ? [[field, value.trim()]] : []
      )
    )

    if (Object.keys(clean).length) {
      entries.push({ reference, referenceId, texts: clean })
    }
  }

  push("product", productId, {
    title: translation.title,
    subtitle: translation.subtitle,
    description: translation.description,
    material: translation.material,
  })

  for (const option of asArray(product?.options)) {
    const record = asRecord(option)
    const title = typeof record?.title === "string" ? record.title : ""
    const given = translation.options?.[title]

    if (!record || typeof record.id !== "string" || !given) {
      continue
    }

    push("product_option", record.id, { title: given.title })

    for (const value of asArray(record.values)) {
      const row = asRecord(value)
      const text = typeof row?.value === "string" ? row.value : ""

      if (typeof row?.id === "string" && given.values?.[text]) {
        push("product_option_value", row.id, { value: given.values[text] })
      }
    }
  }

  for (const variant of asArray(product?.variants)) {
    const record = asRecord(variant)
    const barcode = typeof record?.barcode === "string" ? record.barcode : ""
    const given = translation.variants?.[barcode]

    if (typeof record?.id === "string" && given) {
      push("product_variant", record.id, { title: given.title, material: given.material })
    }
  }

  return entries
}

function graph(container: MedusaContainer): Graph {
  return container.resolve(ContainerRegistrationKeys.QUERY) as Graph
}

function asRecord(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
