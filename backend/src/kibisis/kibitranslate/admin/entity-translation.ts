import type { TranslationJob } from "./ai-translate-modal"
import { request } from "./api"
import {
  buildTranslationBatch,
  collectEntityUnits,
  EntityGroup,
  EntityRecord,
  EntityTranslation,
  mergeEntityTranslations,
  TranslationBatch,
} from "./entity-translation-job"

type TranslationSettings = Record<
  string,
  { fields: string[]; inactive_fields?: string[]; is_active: boolean }
>

/** Entity type of the Translation Module (snake case model name) and the ids to load. */
export type EntityTarget = [type: string, ids: string[]]

const ENTITY_CHUNK = 100
const SAVE_CHUNK = 200

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size))
  }
  return result
}

/**
 * Loads the translatable fields and current translations of the entities.
 * Types whose translation is switched off in the Translation Module are skipped.
 */
export async function loadEntityGroups(targets: EntityTarget[]): Promise<EntityGroup[]> {
  const { translation_settings: settings } = await request<{
    translation_settings: TranslationSettings
  }>("/admin/translations/settings")

  const groups: EntityGroup[] = []
  for (const [type, ids] of targets) {
    const setting = settings[type]
    const fields = (setting?.fields ?? []).filter(
      (field) => !setting?.inactive_fields?.includes(field)
    )
    if (!setting?.is_active || !fields.length || !ids.length) {
      continue
    }

    const records: EntityRecord[] = []
    for (const part of chunks([...new Set(ids)], ENTITY_CHUNK)) {
      const params = new URLSearchParams({ type, limit: String(part.length) })
      part.forEach((id) => params.append("id", id))
      const { data } = await request<{ data: EntityRecord[] }>(
        `/admin/translations/entities?${params}`
      )
      records.push(...data)
    }
    groups.push({ type, fields, records })
  }

  return groups
}

async function saveBatch(batch: TranslationBatch): Promise<EntityTranslation[]> {
  const saved: EntityTranslation[] = []
  const items = [
    ...batch.create.map((item) => ({ create: item })),
    ...batch.update.map((item) => ({ update: item })),
  ]

  for (const part of chunks(items, SAVE_CHUNK)) {
    const body: TranslationBatch = {
      create: part.flatMap((item) => ("create" in item ? [item.create] : [])),
      update: part.flatMap((item) => ("update" in item ? [item.update] : [])),
    }
    const response = await request<{ created: EntityTranslation[]; updated: EntityTranslation[] }>(
      "/admin/translations/batch",
      { method: "POST", body: JSON.stringify(body) }
    )
    saved.push(...response.created, ...response.updated)
  }

  return saved
}

/** A translation job over loaded entity groups that saves each locale's results right away. */
export function createEntityTranslationJob(
  groups: { current: EntityGroup[] },
  context: string,
  onSaved?: () => void
): TranslationJob {
  return {
    context,
    collect: (locale, overwrite) => collectEntityUnits(groups.current, locale, overwrite),
    apply: async (locale, results) => {
      const batch = buildTranslationBatch(groups.current, locale, results)
      if (!batch.create.length && !batch.update.length) {
        return
      }

      const saved = await saveBatch(batch)
      groups.current = mergeEntityTranslations(groups.current, saved)
      onSaved?.()
    },
  }
}
