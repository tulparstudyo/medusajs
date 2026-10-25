import { MedusaError } from "@medusajs/framework/utils"

import { ChallengePurpose, closeChallenge, openChallenge } from "./challenge"

export type LicenseServer = {
  url: string | null
  domain: string
  origin: string
}

/**
 * The shop domain is the host the license server calls back for the
 * challenge, so it must be this backend's public address.
 */
export function licenseServer(): LicenseServer {
  const shopUrl =
    process.env.KIBISIS_SHOP_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  let parsed: URL

  try {
    parsed = new URL(shopUrl)
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `KIBISIS_SHOP_URL geçersiz: ${shopUrl}`)
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
