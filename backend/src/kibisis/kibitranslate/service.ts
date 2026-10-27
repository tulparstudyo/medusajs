import { MedusaError, MedusaService } from "@medusajs/framework/utils"

import type { TranslateFormat } from "./contract"
import { memoryHash, normalizeLocale } from "./memory"
import TranslationMemory from "./models/translation-memory"

export type MemoryEntryDTO = {
  id: string
  hash: string
  source_locale: string
  target_locale: string
  format: string
  source_text: string
  translated_text: string
  provider: string
  edited: boolean
  hits: number
  last_used_at: string | null
  created_at: string | null
  updated_at: string | null
}

export type MemoryListQuery = {
  q?: string
  source_locale?: string
  target_locale?: string
  limit: number
  offset: number
}

export type NewMemoryEntry = {
  source: string
  target: string
  format: TranslateFormat
  text: string
  translated: string
  provider: string
}

type MemoryRow = {
  id: string
  hash: string
  source_locale: string
  target_locale: string
  format: string
  source_text: string
  translated_text: string
  provider: string
  edited: boolean
  hits: number
  last_used_at?: Date | string | null
  created_at?: Date | string | null
  updated_at?: Date | string | null
}

function iso(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : null
}

function present(row: MemoryRow): MemoryEntryDTO {
  return {
    id: row.id,
    hash: row.hash,
    source_locale: row.source_locale,
    target_locale: row.target_locale,
    format: row.format,
    source_text: row.source_text,
    translated_text: row.translated_text,
    provider: row.provider,
    edited: row.edited,
    hits: row.hits,
    last_used_at: iso(row.last_used_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  }
}

class KibitranslateModuleService extends MedusaService({
  TranslationMemory,
}) {
  /** Stored translations by hash; each hit is counted. */
  async recall(hashes: string[]): Promise<Map<string, string>> {
    const found = new Map<string, string>()
    if (!hashes.length) {
      return found
    }

    const rows = (await this.listTranslationMemories({ hash: hashes }, { take: hashes.length })) as MemoryRow[]
    if (!rows.length) {
      return found
    }

    const now = new Date()
    await this.updateTranslationMemories(
      rows.map((row) => ({ id: row.id, hits: row.hits + 1, last_used_at: now }))
    )

    for (const row of rows) {
      found.set(row.hash, row.translated_text)
    }
    return found
  }

  /** Saves new translations; texts another request saved meanwhile are skipped. */
  async remember(entries: NewMemoryEntry[]): Promise<void> {
    const rows = entries
      .filter((entry) => entry.translated.trim() !== "")
      .map((entry) => ({
        hash: memoryHash(entry),
        source_locale: normalizeLocale(entry.source),
        target_locale: normalizeLocale(entry.target),
        format: entry.format,
        source_text: entry.text,
        translated_text: entry.translated,
        provider: entry.provider,
        hits: 0,
        last_used_at: null,
      }))
    if (!rows.length) {
      return
    }

    const existing = (await this.listTranslationMemories(
      { hash: rows.map((row) => row.hash) },
      { take: rows.length, select: ["hash"] }
    )) as Pick<MemoryRow, "hash">[]
    const known = new Set(existing.map((row) => row.hash))
    const fresh = rows.filter((row, index) => {
      const firstOfHash = rows.findIndex((other) => other.hash === row.hash) === index
      return firstOfHash && !known.has(row.hash)
    })

    for (const row of fresh) {
      try {
        await this.createTranslationMemories(row)
      } catch {
        // A parallel request stored the same hash first; its row is kept.
      }
    }
  }

  async listEntries(query: MemoryListQuery): Promise<{ entries: MemoryEntryDTO[]; count: number }> {
    const filters: Record<string, unknown> = {}
    if (query.source_locale) {
      filters.source_locale = normalizeLocale(query.source_locale)
    }
    if (query.target_locale) {
      filters.target_locale = normalizeLocale(query.target_locale)
    }
    if (query.q) {
      const pattern = `%${query.q.replace(/[%_\\]/g, (match) => `\\${match}`)}%`
      filters.$or = [
        { source_text: { $ilike: pattern } },
        { translated_text: { $ilike: pattern } },
      ]
    }

    const [rows, count] = await this.listAndCountTranslationMemories(filters, {
      take: query.limit,
      skip: query.offset,
      order: { updated_at: "DESC" },
    })

    return { entries: (rows as MemoryRow[]).map(present), count }
  }

  async locales(): Promise<{ source: string[]; target: string[] }> {
    const rows = (await this.listTranslationMemories(
      {},
      { select: ["source_locale", "target_locale"], take: 10_000 }
    )) as Pick<MemoryRow, "source_locale" | "target_locale">[]

    return {
      source: [...new Set(rows.map((row) => row.source_locale))].sort(),
      target: [...new Set(rows.map((row) => row.target_locale))].sort(),
    }
  }

  async editEntry(id: string, translated: string): Promise<MemoryEntryDTO> {
    await this.retrieveEntry(id)
    const updated = (await this.updateTranslationMemories({
      id,
      translated_text: translated,
      edited: true,
    })) as MemoryRow
    return present(updated)
  }

  async getEntry(id: string): Promise<MemoryEntryDTO> {
    return present((await this.retrieveEntry(id)) as MemoryRow)
  }

  async restoreEntry(entry: MemoryEntryDTO): Promise<void> {
    await this.updateTranslationMemories({
      id: entry.id,
      translated_text: entry.translated_text,
      edited: entry.edited,
    })
  }

  /** Deletes the entries and returns them so a failed workflow can put them back. */
  async deleteEntries(ids: string[]): Promise<MemoryEntryDTO[]> {
    if (!ids.length) {
      return []
    }
    const rows = (await this.listTranslationMemories({ id: ids }, { take: ids.length })) as MemoryRow[]
    if (rows.length) {
      await this.deleteTranslationMemories(rows.map((row) => row.id))
    }
    return rows.map(present)
  }

  async recreateEntries(entries: MemoryEntryDTO[]): Promise<void> {
    if (!entries.length) {
      return
    }
    await this.createTranslationMemories(
      entries.map((entry) => ({
        id: entry.id,
        hash: entry.hash,
        source_locale: entry.source_locale,
        target_locale: entry.target_locale,
        format: entry.format,
        source_text: entry.source_text,
        translated_text: entry.translated_text,
        provider: entry.provider,
        edited: entry.edited,
        hits: entry.hits,
        last_used_at: entry.last_used_at ? new Date(entry.last_used_at) : null,
      }))
    )
  }

  private async retrieveEntry(id: string) {
    const [row] = await this.listTranslationMemories({ id }, { take: 1 })
    if (!row) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Çeviri kaydı bulunamadı.")
    }
    return row
  }
}

export default KibitranslateModuleService
