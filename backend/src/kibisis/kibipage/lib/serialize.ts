import { PageKey, SectionDTO, SectionSettings } from "../types"

type SectionRecord = {
  id: string
  page_id: string
  type: string
  name: string
  position: number
  is_active: boolean
  settings?: unknown
}

export function readSettings(value: unknown): SectionSettings {
  if (!value) {
    return {}
  }

  if (typeof value === "string") {
    try {
      return readSettings(JSON.parse(value) as unknown)
    } catch {
      return {}
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as SectionSettings
  }

  return {}
}

export function serializeSection(
  section: SectionRecord,
  pageKey: PageKey
): SectionDTO {
  return {
    id: section.id,
    page_id: section.page_id,
    page_key: pageKey,
    type: section.type,
    name: section.name,
    position: section.position,
    is_active: section.is_active,
    settings: readSettings(section.settings),
  }
}
