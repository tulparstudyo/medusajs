import type { TranslatedUnit, TranslationUnit } from "./api"

/** A Translation Module record: one locale's texts for one entity. */
export type EntityTranslation = {
  id: string
  reference_id: string
  reference: string
  locale_code: string
  translations: Record<string, string> | null
}

export type EntityRecord = {
  id: string
  translations?: EntityTranslation[]
  [field: string]: unknown
}

/** Entities of one type with the fields that may be translated. */
export type EntityGroup = {
  type: string
  fields: string[]
  records: EntityRecord[]
}

export type TranslationBatch = {
  create: {
    reference_id: string
    reference: string
    locale_code: string
    translations: Record<string, string>
  }[]
  update: { id: string; translations: Record<string, string> }[]
}

type UnitKey = [type: string, id: string, field: string]

const HTML_TAG = /<\/?[a-z][^>]*>/i

function sameLocale(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase()
}

function localeRecord(record: EntityRecord, locale: string) {
  return record.translations?.find((item) => sameLocale(item.locale_code, locale))
}

/** Texts that still need a translation in the locale, or all of them when overwriting. */
export function collectEntityUnits(
  groups: EntityGroup[],
  locale: string,
  overwrite: boolean
): TranslationUnit[] {
  const units: TranslationUnit[] = []

  for (const group of groups) {
    for (const record of group.records) {
      const current = localeRecord(record, locale)?.translations ?? {}
      for (const field of group.fields) {
        const value = record[field]
        const text = typeof value === "string" ? value.trim() : ""
        if (!text || (!overwrite && current[field]?.trim())) {
          continue
        }

        const key: UnitKey = [group.type, record.id, field]
        units.push({
          key: JSON.stringify(key),
          text,
          format: HTML_TAG.test(text) ? "html" : "text",
        })
      }
    }
  }

  return units
}

/** Turns one locale's results into creates and updates for /admin/translations/batch. */
export function buildTranslationBatch(
  groups: EntityGroup[],
  locale: string,
  results: TranslatedUnit[]
): TranslationBatch {
  const byEntity = new Map<string, { type: string; id: string; texts: Record<string, string> }>()

  for (const result of results) {
    const [type, id, field] = JSON.parse(result.key) as UnitKey
    const entry = byEntity.get(`${type}:${id}`) ?? { type, id, texts: {} }
    entry.texts[field] = result.text
    byEntity.set(`${type}:${id}`, entry)
  }

  const batch: TranslationBatch = { create: [], update: [] }
  for (const { type, id, texts } of byEntity.values()) {
    const record = groups
      .find((group) => group.type === type)
      ?.records.find((item) => item.id === id)
    const existing = record ? localeRecord(record, locale) : undefined

    if (existing) {
      batch.update.push({ id: existing.id, translations: { ...existing.translations, ...texts } })
    } else {
      batch.create.push({ reference_id: id, reference: type, locale_code: locale, translations: texts })
    }
  }

  return batch
}

/** Puts saved translation records back on their entities. */
export function mergeEntityTranslations(
  groups: EntityGroup[],
  saved: EntityTranslation[]
): EntityGroup[] {
  return groups.map((group) => ({
    ...group,
    records: group.records.map((record) => {
      const mine = saved.filter(
        (item) => item.reference === group.type && item.reference_id === record.id
      )
      if (!mine.length) {
        return record
      }

      const kept = (record.translations ?? []).filter(
        (item) => !mine.some((next) => next.id === item.id)
      )
      return { ...record, translations: [...kept, ...mine] }
    }),
  }))
}
