import { createHash } from "node:crypto"

import type { TranslateFormat } from "./contract"

export type MemoryKey = {
  source: string
  target: string
  format: TranslateFormat
  text: string
}

export function normalizeLocale(locale: string) {
  return locale.trim().replace("_", "-").toLowerCase()
}

/** Identifies a source text in one language pair and format. */
export function memoryHash(key: MemoryKey) {
  return createHash("sha256")
    .update(JSON.stringify([normalizeLocale(key.source), normalizeLocale(key.target), key.format, key.text]))
    .digest("hex")
}
