import {
  SECTION_TRANSLATABLE,
  SectionSettings,
  SectionTranslations,
  SectionType,
  TranslationLayer,
} from "../types"

const LOCALE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
const MAX_LENGTH = 300

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function cleanFields(source: unknown, fields: string[]): Record<string, string> | undefined {
  if (!isRecord(source)) {
    return undefined
  }

  const result: Record<string, string> = {}
  for (const field of fields) {
    const value = source[field]
    if (typeof value === "string" && value.trim()) {
      result[field] = value.trim().slice(0, MAX_LENGTH)
    }
  }

  return Object.keys(result).length ? result : undefined
}

function itemIds(settings: SectionSettings, list: string): Set<string> {
  const items = settings[list]
  const ids = new Set<string>()
  if (Array.isArray(items)) {
    for (const item of items) {
      if (isRecord(item) && typeof item.id === "string") {
        ids.add(item.id)
      }
    }
  }
  return ids
}

function cleanLayer(type: SectionType, settings: SectionSettings, raw: unknown) {
  if (!isRecord(raw)) {
    return undefined
  }

  const spec = SECTION_TRANSLATABLE[type]
  const layer: TranslationLayer = {}

  const fields = cleanFields(raw.fields, spec.fields)
  if (fields) {
    layer.fields = fields
  }

  const rawLists = isRecord(raw.lists) ? raw.lists : {}
  for (const [list, listFields] of Object.entries(spec.lists)) {
    const rawItems = rawLists[list]
    if (!isRecord(rawItems)) {
      continue
    }

    const ids = itemIds(settings, list)
    const items: Record<string, Record<string, string>> = {}
    for (const [id, value] of Object.entries(rawItems)) {
      const cleaned = ids.has(id) ? cleanFields(value, listFields) : undefined
      if (cleaned) {
        items[id] = cleaned
      }
    }

    if (Object.keys(items).length) {
      layer.lists = { ...layer.lists, [list]: items }
    }
  }

  const rawGroups = isRecord(raw.groups) ? raw.groups : {}
  for (const [group, groupFields] of Object.entries(spec.groups)) {
    const cleaned = cleanFields(rawGroups[group], groupFields)
    if (cleaned) {
      layer.groups = { ...layer.groups, [group]: cleaned }
    }
  }

  return Object.keys(layer).length ? layer : undefined
}

export function takeTranslations(settings: unknown): {
  content: unknown
  translations: unknown
} {
  if (!isRecord(settings) || !("translations" in settings)) {
    return { content: settings, translations: undefined }
  }

  const { translations, ...content } = settings
  return { content, translations }
}

export function cleanTranslations(
  type: SectionType,
  settings: SectionSettings,
  raw: unknown
): SectionTranslations | undefined {
  if (!isRecord(raw)) {
    return undefined
  }

  const result: SectionTranslations = {}
  for (const [code, value] of Object.entries(raw)) {
    if (!LOCALE_CODE.test(code)) {
      continue
    }

    const layer = cleanLayer(type, settings, value)
    if (layer) {
      result[code] = layer
    }
  }

  return Object.keys(result).length ? result : undefined
}

function pickLayer(translations: unknown, locale: string): TranslationLayer | undefined {
  if (!isRecord(translations)) {
    return undefined
  }

  const wanted = locale.toLowerCase()
  const language = wanted.split("-")[0]
  const entries = Object.entries(translations)
  const exact = entries.find(([code]) => code.toLowerCase() === wanted)
  const partial = entries.find(([code]) => code.toLowerCase().split("-")[0] === language)
  const layer = (exact ?? partial)?.[1]

  return isRecord(layer) ? (layer as TranslationLayer) : undefined
}

/**
 * Returns the settings with the requested locale's translations merged in and
 * the translations map removed. Untranslated fields keep the base content.
 */
export function localizeSettings(
  settings: SectionSettings,
  locale: string | undefined
): SectionSettings {
  const { content, translations } = takeTranslations(settings)
  const base = (isRecord(content) ? content : {}) as SectionSettings
  const layer = locale ? pickLayer(translations, locale) : undefined
  if (!layer) {
    return base
  }

  const next: SectionSettings = { ...base, ...(layer.fields ?? {}) }

  for (const [list, items] of Object.entries(layer.lists ?? {})) {
    const current = base[list]
    if (!Array.isArray(current)) {
      continue
    }

    next[list] = current.map((item) =>
      isRecord(item) && typeof item.id === "string" && items[item.id]
        ? { ...item, ...items[item.id] }
        : item
    )
  }

  for (const [group, fields] of Object.entries(layer.groups ?? {})) {
    const current = base[group]
    if (isRecord(current)) {
      next[group] = { ...current, ...fields }
    }
  }

  return next
}
