import type { TranslatedUnit, TranslationUnit } from "../../kibitranslate/admin/api"
import {
  SECTION_TRANSLATABLE,
  SectionSettings,
  SectionType,
  TranslationLayer,
} from "../types"

type Path = ["field", string] | ["group", string, string] | ["list", string, string, string]

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function filled(value: unknown) {
  return typeof value === "string" && value.trim() !== ""
}

function sourceText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

/** Section texts that still need a translation in the layer, or all of them when overwriting. */
export function collectSectionUnits(
  type: SectionType,
  content: SectionSettings,
  layer: TranslationLayer,
  overwrite: boolean
): TranslationUnit[] {
  const spec = SECTION_TRANSLATABLE[type]
  const units: TranslationUnit[] = []
  const add = (path: Path, text: string, current: unknown) => {
    if (text && (overwrite || !filled(current))) {
      units.push({ key: JSON.stringify(path), text })
    }
  }

  for (const field of spec.fields) {
    add(["field", field], sourceText(content[field]), layer.fields?.[field])
  }

  for (const [group, fields] of Object.entries(spec.groups)) {
    const base = isRecord(content[group]) ? content[group] : {}
    for (const field of fields) {
      add(["group", group, field], sourceText(base[field]), layer.groups?.[group]?.[field])
    }
  }

  for (const [list, fields] of Object.entries(spec.lists)) {
    const items = Array.isArray(content[list]) ? content[list] : []
    for (const item of items) {
      if (!isRecord(item) || typeof item.id !== "string") {
        continue
      }
      for (const field of fields) {
        add(["list", list, item.id, field], sourceText(item[field]), layer.lists?.[list]?.[item.id]?.[field])
      }
    }
  }

  return units
}

type PageSection = { id: string; type: string; settings: SectionSettings }

type SectionKey = [sectionId: string, unitKey: string]

function readLayer(settings: SectionSettings, locale: string): TranslationLayer {
  const translations = settings.translations
  const layer = isRecord(translations) ? translations[locale] : undefined
  return isRecord(layer) ? (layer as TranslationLayer) : {}
}

/** Units of every translatable section on a page, keyed by section id. */
export function collectPageUnits(
  sections: PageSection[],
  locale: string,
  overwrite: boolean
): TranslationUnit[] {
  const units: TranslationUnit[] = []
  for (const section of sections) {
    if (!(section.type in SECTION_TRANSLATABLE)) {
      continue
    }

    const type = section.type as SectionType
    for (const unit of collectSectionUnits(type, section.settings, readLayer(section.settings, locale), overwrite)) {
      const key: SectionKey = [section.id, unit.key]
      units.push({ ...unit, key: JSON.stringify(key) })
    }
  }
  return units
}

/** Splits page-level results back into per-section results. */
export function splitPageResults(results: TranslatedUnit[]): Map<string, TranslatedUnit[]> {
  const bySection = new Map<string, TranslatedUnit[]>()
  for (const result of results) {
    const [sectionId, key] = JSON.parse(result.key) as SectionKey
    bySection.set(sectionId, [...(bySection.get(sectionId) ?? []), { key, text: result.text }])
  }
  return bySection
}

export function applySectionResults(layer: TranslationLayer, results: TranslatedUnit[]): TranslationLayer {
  const next: TranslationLayer = {
    fields: { ...layer.fields },
    groups: { ...layer.groups },
    lists: { ...layer.lists },
  }

  for (const result of results) {
    const path = JSON.parse(result.key) as Path
    if (path[0] === "field") {
      next.fields![path[1]] = result.text
    } else if (path[0] === "group") {
      next.groups![path[1]] = { ...next.groups![path[1]], [path[2]]: result.text }
    } else {
      const [, list, id, field] = path
      const items = { ...next.lists![list] }
      items[id] = { ...items[id], [field]: result.text }
      next.lists![list] = items
    }
  }

  return next
}
