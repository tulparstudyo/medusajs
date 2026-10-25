import { ImportException } from "../../errors"

const MARKER = 'window["__envoy__SHARED_PROPS"]={'

export function sharedProps(html: string): Record<string, unknown> {
  const start = html.indexOf(MARKER)

  if (start < 0) {
    throw new ImportException("Trendyol sayfasında ürün verisi bulunamadı.")
  }

  const json = jsonObject(html, start + MARKER.length - 1)
  const decoded: unknown = JSON.parse(json)

  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new ImportException("Trendyol sayfasındaki ürün verisi okunamadı.")
  }

  return decoded as Record<string, unknown>
}

export function jsonObject(html: string, start: number): string {
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < html.length; index += 1) {
    const char = html[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === "\\") {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === "{") {
      depth += 1
      continue
    }

    if (char === "}") {
      depth -= 1

      if (depth === 0) {
        return html.slice(start, index + 1)
      }
    }
  }

  throw new ImportException("Trendyol sayfasındaki ürün verisi okunamadı.")
}
