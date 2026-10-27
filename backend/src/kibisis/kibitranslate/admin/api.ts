import type { TranslateFormat } from "../contract"

export type TranslateStatus = {
  enabled: boolean
  provider: string
  label: string
  configured: boolean
}

/** One text to translate; `key` tells the caller where the result belongs. */
export type TranslationUnit = {
  key: string
  text: string
  format?: TranslateFormat
}

export type TranslatedUnit = {
  key: string
  text: string
}

/** Matches the server's per-request limit. */
const REQUEST_SIZE = 400

export class TranslateRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("accept", "application/json")
  if (init?.body) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(path, { ...init, headers })
  const text = await response.text()
  let body: { message?: string } | null = null
  try {
    body = text ? (JSON.parse(text) as { message?: string }) : null
  } catch {
    body = null
  }

  if (!response.ok) {
    throw new TranslateRequestError(response.status, body?.message || "Çeviri isteği tamamlanamadı.")
  }
  return body as T
}

export async function fetchTranslateStatus(): Promise<TranslateStatus> {
  const body = await request<{ status: TranslateStatus }>("/admin/kibitranslate")
  return body.status
}

/**
 * Translates units of any content type (section texts, product fields, menu
 * labels...) and returns the non-empty results with their keys.
 */
export async function translateUnits(input: {
  source: string
  target: string
  units: TranslationUnit[]
  context?: string
}): Promise<TranslatedUnit[]> {
  const results: TranslatedUnit[] = []

  for (const format of ["text", "html"] as const) {
    const units = input.units.filter((unit) => (unit.format ?? "text") === format && unit.text.trim())

    for (let start = 0; start < units.length; start += REQUEST_SIZE) {
      const chunk = units.slice(start, start + REQUEST_SIZE)
      const body = await request<{ texts: string[] }>("/admin/kibitranslate", {
        method: "POST",
        body: JSON.stringify({
          source: input.source,
          target: input.target,
          texts: chunk.map((unit) => unit.text),
          format,
          ...(input.context ? { context: input.context } : {}),
        }),
      })

      chunk.forEach((unit, index) => {
        const text = body.texts[index]?.trim()
        if (text) {
          results.push({ key: unit.key, text })
        }
      })
    }
  }

  return results
}
