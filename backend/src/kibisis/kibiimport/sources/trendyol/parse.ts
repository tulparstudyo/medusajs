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

/**
 * ColorLinks reads the other colors of a product from the ProductGroup
 * structured data. Trendyol lists every sibling color there with its own link
 * and leaves the current product out.
 */
export function colorLinks(html: string): string[] {
  const links: string[] = []
  const blocks = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)

  for (const block of blocks) {
    let decoded: unknown

    try {
      decoded = JSON.parse(block[1] ?? "")
    } catch {
      continue
    }

    const group = asRecord(decoded)

    if (group?.["@type"] !== "ProductGroup") {
      continue
    }

    for (const variant of Array.isArray(group.hasVariant) ? group.hasVariant : []) {
      const record = asRecord(variant)
      const offers = Array.isArray(record?.offers) ? record?.offers : [record?.offers]
      const urls = [record?.url, ...offers.map((offer) => asRecord(offer)?.url)]
      const url = urls.find((value): value is string => typeof value === "string" && value !== "")

      if (url && !links.includes(url)) {
        links.push(url)
      }
    }
  }

  return links
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
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
