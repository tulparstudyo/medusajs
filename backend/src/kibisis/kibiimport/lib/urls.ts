import { ImportException } from "../errors"

const MAX_URL_LENGTH = 2048

export function splitProductUrls(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
}

export function productHost(url: string): string {
  const trimmed = url.trim()

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new ImportException("Ürün linki geçerli bir http adresi değil.")
  }

  let parsed: URL

  try {
    parsed = new URL(trimmed)
  } catch {
    throw new ImportException("Ürün linki geçerli bir http adresi değil.")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ImportException("Ürün linki geçerli bir http adresi değil.")
  }

  if (!parsed.hostname) {
    throw new ImportException("Ürün linki geçerli bir http adresi değil.")
  }

  const host = parsed.hostname.toLowerCase()

  return host.startsWith("www.") ? host.slice(4) : host
}

export function hostMatches(host: string, candidate: string): boolean {
  return host === candidate || host.endsWith(`.${candidate}`)
}
