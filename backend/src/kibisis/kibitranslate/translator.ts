import { MedusaError } from "@medusajs/framework/utils"

import { KIBISETTINGS_MODULE } from "../kibisettings"
import KibisettingsModuleService from "../kibisettings/service"
import { TranslateSettings } from "../kibisettings/types"
import {
  ProviderDefinition,
  TranslateAdapter,
  TranslateError,
  TranslateFormat,
  TranslateRequest,
} from "./contract"
import { KIBITRANSLATE_MODULE } from "."
import { memoryHash } from "./memory"
import { translateProvider } from "./registry"
import KibitranslateModuleService from "./service"

type Container = { resolve: <T>(key: string) => T }

export type TranslateStatus = {
  enabled: boolean
  provider: string
  label: string
  configured: boolean
}

/** A record of any content type: a product, a category, a menu item, a page section. */
export type TranslateRecord = {
  id: string
  fields: Record<string, string>
}

export type TranslateRecordsRequest = {
  source: string
  target: string
  records: TranslateRecord[]
  /** Field names whose values are HTML, e.g. ["description"]. */
  htmlFields?: string[]
  context?: string
}

function credentialsOf(provider: ProviderDefinition, settings: TranslateSettings) {
  const values = settings as unknown as Record<string, unknown>
  const credentials: Record<string, string> = {}
  for (const field of provider.credentials) {
    const value = values[`${provider.id}_${field.key}`]
    credentials[field.key] = typeof value === "string" ? value : ""
  }
  return credentials
}

async function settingsOf(container: Container) {
  return container
    .resolve<KibisettingsModuleService>(KIBISETTINGS_MODULE)
    .getSecretSettings("translate")
}

/** Splits texts into calls that respect both the text count and the size limit. */
export function batchesOf(texts: string[], adapter: Pick<TranslateAdapter, "maxBatch" | "maxChars">) {
  const batches: string[][] = []
  let current: string[] = []
  let size = 0

  for (const text of texts) {
    const full = current.length >= adapter.maxBatch || size + text.length > adapter.maxChars
    if (current.length && full) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(text)
    size += text.length
  }

  if (current.length) {
    batches.push(current)
  }
  return batches
}

/**
 * Splits a single text that exceeds `maxChars` into smaller pieces at safe
 * boundaries (newlines, closing HTML tags, or spaces) so providers with per-call
 * character/token limits can translate long HTML documents without truncation.
 */
export function splitLongText(text: string, maxChars: number): string[] {
  if (maxChars <= 0 || text.length <= maxChars) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    if (text.length - start <= maxChars) {
      const tail = text.slice(start)
      if (tail.trim()) {
        chunks.push(tail)
      }
      break
    }

    const window = text.slice(start, start + maxChars)
    const minBreak = Math.floor(maxChars * 0.5)
    let cut = -1

    const newline = window.lastIndexOf("\n")
    if (newline >= minBreak) {
      cut = newline + 1
    }

    if (cut === -1) {
      const tagClose = window.lastIndexOf(">")
      if (tagClose >= minBreak) {
        cut = tagClose + 1
      }
    }

    if (cut === -1) {
      const openTag = window.lastIndexOf("<")
      const closeTag = window.lastIndexOf(">")
      if (openTag > closeTag && openTag > 0) {
        cut = openTag
      }
    }

    if (cut === -1) {
      const space = window.lastIndexOf(" ")
      if (space >= minBreak) {
        cut = space + 1
      }
    }

    if (cut <= 0) {
      cut = maxChars
    }

    const piece = text.slice(start, start + cut)
    if (piece.trim()) {
      chunks.push(piece)
    }
    start += cut
  }

  return chunks.length ? chunks : [text]
}

function joinTranslatedChunks(sourceChunks: string[], translatedChunks: string[]): string {
  if (translatedChunks.length <= 1) {
    return translatedChunks[0] ?? ""
  }

  let out = ""
  for (let i = 0; i < translatedChunks.length; i++) {
    const piece = translatedChunks[i] ?? ""
    if (!piece) {
      continue
    }
    if (out) {
      const prevSource = sourceChunks[i - 1] ?? ""
      const sep = prevSource.endsWith("\n") && !out.endsWith("\n")
        ? "\n"
        : /\s$/.test(prevSource) && !/\s$/.test(out) && !/^\s/.test(piece)
          ? " "
          : ""
      out += sep
    }
    out += piece
  }
  return out
}

export async function translateStatus(container: Container): Promise<TranslateStatus> {
  const settings = await settingsOf(container)
  const provider = translateProvider(settings.provider)

  return {
    enabled: settings.enabled,
    provider: settings.provider,
    label: provider?.label ?? settings.provider,
    configured:
      !!provider && provider.isConfigured({ credentials: credentialsOf(provider, settings) }),
  }
}

/**
 * Translates the texts with the provider selected in the AI translate
 * settings and returns one result per input text, in order. Texts already in
 * the translation memory are served from it; only the rest reach the
 * provider, and their results are stored. Blank texts come back unchanged,
 * repeated texts are sent once, and calls are split to fit the provider's
 * limits. A text the provider skipped comes back as "".
 */
export async function translateTexts(
  container: Container,
  request: TranslateRequest
): Promise<string[]> {
  const settings = await settingsOf(container)
  if (!settings.enabled) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "AI çeviri kapalı. Site Ayarları → AI Çeviri bölümünden açın."
    )
  }

  const unique = [...new Set(request.texts.filter((text) => text.trim() !== ""))]
  if (!unique.length) {
    return request.texts.map((text) => text)
  }

  const format = request.format ?? "text"
  const memory = container.resolve<KibitranslateModuleService>(KIBITRANSLATE_MODULE)
  const hashes = new Map(
    unique.map((text) => [text, memoryHash({ source: request.source, target: request.target, format, text })])
  )
  const recalled = await memory.recall([...hashes.values()])
  const translated = new Map<string, string>()
  for (const text of unique) {
    const stored = recalled.get(hashes.get(text)!)
    if (stored !== undefined) {
      translated.set(text, stored)
    }
  }

  const missing = unique.filter((text) => !translated.has(text))
  if (!missing.length) {
    return request.texts.map((text) => (text.trim() === "" ? text : (translated.get(text) ?? "")))
  }

  const provider = translateProvider(settings.provider)
  if (!provider) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Seçili çeviri hizmeti desteklenmiyor.")
  }

  try {
    const client = provider.createClient({ credentials: credentialsOf(provider, settings) })
    const maxChars = provider.adapter.maxChars
    const shortTexts = missing.filter((text) => text.length <= maxChars)
    const longTexts = missing.filter((text) => text.length > maxChars)

    for (const texts of batchesOf(shortTexts, provider.adapter)) {
      const batch = { ...request, format, texts }
      const response = await client.translate(provider.adapter.toTranslate(batch))
      const results = provider.adapter.fromTranslate(batch, response)
      texts.forEach((text, index) => translated.set(text, results[index] ?? ""))
      await memory.remember(
        texts.map((text) => ({
          source: request.source,
          target: request.target,
          format,
          text,
          translated: translated.get(text) ?? "",
          provider: provider.id,
        }))
      )
    }

    for (const longText of longTexts) {
      const sourceChunks = splitLongText(longText, maxChars)
      const translatedChunks: string[] = []
      for (const texts of batchesOf(sourceChunks, provider.adapter)) {
        const batch = { ...request, format, texts }
        const response = await client.translate(provider.adapter.toTranslate(batch))
        const results = provider.adapter.fromTranslate(batch, response)
        translatedChunks.push(...texts.map((_, index) => results[index] ?? ""))
      }
      const fullResult = joinTranslatedChunks(sourceChunks, translatedChunks)
      translated.set(longText, fullResult)
      await memory.remember([
        {
          source: request.source,
          target: request.target,
          format,
          text: longText,
          translated: fullResult,
          provider: provider.id,
        },
      ])
    }
  } catch (error) {
    if (error instanceof TranslateError) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message)
    }
    throw error
  }

  return request.texts.map((text) => (text.trim() === "" ? text : (translated.get(text) ?? "")))
}

/**
 * Translates the fields of content records (products, categories, menu
 * items...) and returns them with the same ids and field names. Empty and
 * untranslated fields are left out of the result.
 */
export async function translateRecords(
  container: Container,
  request: TranslateRecordsRequest
): Promise<TranslateRecord[]> {
  const html = new Set(request.htmlFields ?? [])
  const slots: Record<TranslateFormat, { id: string; field: string; text: string }[]> = {
    text: [],
    html: [],
  }

  for (const record of request.records) {
    for (const [field, text] of Object.entries(record.fields)) {
      if (typeof text === "string" && text.trim()) {
        slots[html.has(field) ? "html" : "text"].push({ id: record.id, field, text })
      }
    }
  }

  const results = new Map<string, Record<string, string>>()
  for (const format of ["text", "html"] as const) {
    const entries = slots[format]
    if (!entries.length) {
      continue
    }

    const texts = await translateTexts(container, {
      source: request.source,
      target: request.target,
      texts: entries.map((entry) => entry.text),
      format,
      context: request.context,
    })

    entries.forEach((entry, index) => {
      const value = texts[index]?.trim()
      if (value) {
        results.set(entry.id, { ...results.get(entry.id), [entry.field]: value })
      }
    })
  }

  return request.records
    .filter((record) => results.has(record.id))
    .map((record) => ({ id: record.id, fields: results.get(record.id)! }))
}
