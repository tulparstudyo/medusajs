import { MedusaError } from "@medusajs/framework/utils"

import { ChallengePurpose, closeChallenge, openChallenge } from "./challenge"

export type LicenseServer = {
  url: string | null
  domain: string
  origin: string
}

type HeaderBag = Record<string, string | string[] | undefined>

const DEFAULT_SHOP_URL = "http://localhost:9000"
const LOCAL_OR_TEMPLATE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "medusajs.test",
  "docs.medusajs.com",
])

let lastRequestUrl: URL | null = null

function isPublicUrl(url: URL): boolean {
  return !LOCAL_OR_TEMPLATE_HOSTS.has(url.hostname.toLowerCase())
}

function headerValue(headers: HeaderBag, name: string): string {
  const raw = headers[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === "string" ? value.split(",")[0].trim() : ""
}

/**
 * Captures the public origin from an incoming admin request so deployments
 * where KIBISIS_SHOP_URL was left at its localhost default still use the
 * real shop domain.
 */
export function rememberRequestOrigin(req?: { headers?: HeaderBag } | null): void {
  const headers = req?.headers
  if (!headers) {
    return
  }

  const origin = headerValue(headers, "origin")
  if (origin) {
    try {
      const parsed = new URL(origin)
      if (isPublicUrl(parsed)) {
        lastRequestUrl = parsed
        return
      }
    } catch {
      // Fall through to Host headers.
    }
  }

  const host = headerValue(headers, "x-forwarded-host") || headerValue(headers, "host")
  if (!host) {
    return
  }

  const proto = headerValue(headers, "x-forwarded-proto") || "https"
  try {
    const parsed = new URL(`${proto}://${host}`)
    if (isPublicUrl(parsed)) {
      lastRequestUrl = parsed
    }
  } catch {
    // Ignore malformed Host header.
  }
}

function firstPublicEnvUrl(): URL | null {
  const candidates = [
    process.env.MEDUSA_BACKEND_URL,
    process.env.KIBISIS_STORE_URL,
    process.env.ADMIN_CORS,
    process.env.AUTH_CORS,
    process.env.STORE_CORS,
    process.env.CDN_URL,
  ]

  for (const raw of candidates) {
    if (!raw) {
      continue
    }
    for (const part of raw.split(",")) {
      const trimmed = part.trim()
      if (!trimmed) {
        continue
      }
      try {
        const parsed = new URL(trimmed)
        if (isPublicUrl(parsed)) {
          return parsed
        }
      } catch {
        // Ignore malformed fallback entries.
      }
    }
  }

  return null
}

/**
 * The shop domain is the host the license server calls back for the
 * challenge, so it must be this backend's public address.
 */
export function licenseServer(): LicenseServer {
  const shopUrl =
    process.env.KIBISIS_SHOP_URL || process.env.MEDUSA_BACKEND_URL || DEFAULT_SHOP_URL
  let parsed: URL

  try {
    parsed = new URL(shopUrl)
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `KIBISIS_SHOP_URL geçersiz: ${shopUrl}`)
  }

  if (!isPublicUrl(parsed)) {
    parsed = firstPublicEnvUrl() ?? lastRequestUrl ?? parsed
  }

  const url = (process.env.KIBISIS_LICENSE_SERVER_URL || "").replace(/\/+$/, "")

  return { url: url || null, domain: parsed.host.toLowerCase(), origin: parsed.origin }
}

export async function callLicenseServer(
  endpoint: "install.php" | "verify.php",
  repo: string,
  purpose: ChallengePurpose,
  timeoutMs: number
): Promise<Response> {
  const server = licenseServer()

  if (!server.url) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "KIBISIS_LICENSE_SERVER_URL tanımlı değil.")
  }

  const challengeId = openChallenge({ domain: server.domain, repo, purpose })

  try {
    return await fetch(`${server.url}/${endpoint}`, {
      method: "POST",
      headers: {
        accept: endpoint === "install.php" ? "application/zip" : "application/json",
        "content-type": "application/json",
        origin: server.origin,
      },
      body: JSON.stringify({ domain: server.domain, repo, challenge_id: challengeId }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Lisans sunucusuna ulaşılamadı: ${reason}`)
  } finally {
    closeChallenge(challengeId)
  }
}

export async function licenseServerMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string }
    if (body?.message) {
      return body.message
    }
  } catch {
    // The body was not JSON; fall back to the status code.
  }

  return `Lisans sunucusu HTTP ${response.status} döndü.`
}
