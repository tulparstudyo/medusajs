import { MedusaError } from "@medusajs/framework/utils"

import { callLicenseServer, licenseServerMessage } from "./license-server"
import { CarrierLicenseDTO } from "./types"

const VALID_TTL_MS = 24 * 60 * 60_000
const INVALID_TTL_MS = 5 * 60_000
const GRACE_MS = 7 * 24 * 60 * 60_000
const TIMEOUT_MS = 15_000

type Entry = { status: CarrierLicenseDTO; at: number }

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<CarrierLicenseDTO>>()

function status(
  valid: boolean,
  reason: string | null,
  body: { customer?: string | null; expires_at?: string | null; ref?: string | null } = {}
): CarrierLicenseDTO {
  return {
    valid,
    reason,
    customer: body.customer ?? null,
    expires_at: body.expires_at ?? null,
    ref: body.ref ?? null,
    checked_at: new Date().toISOString(),
  }
}

async function verify(repo: string): Promise<CarrierLicenseDTO> {
  const previous = cache.get(repo)
  let result: CarrierLicenseDTO

  try {
    const response = await callLicenseServer("verify.php", repo, "verify", TIMEOUT_MS)

    if (response.ok) {
      const body = (await response.json()) as {
        valid?: boolean
        customer?: string | null
        expires_at?: string | null
        ref?: string | null
      }
      result = body?.valid ? status(true, null, body) : status(false, "Lisans sunucusu lisansı onaylamadı.")
    } else if (response.status >= 500) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, await licenseServerMessage(response))
    } else {
      result = status(false, await licenseServerMessage(response))
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    if (previous?.status.valid && Date.now() - previous.at < GRACE_MS) {
      return { ...previous.status, reason: `${reason} Son başarılı doğrulama geçerli sayıldı.` }
    }

    result = status(false, reason)
  }

  cache.set(repo, { status: result, at: Date.now() })
  return result
}

/**
 * Asks the license server whether this domain may use the repo. Answers are
 * cached; when the server is unreachable a recent valid answer is kept for
 * a grace period.
 */
export function licenseStatus(repo: string, options: { force?: boolean } = {}): Promise<CarrierLicenseDTO> {
  const cached = cache.get(repo)

  if (!options.force && cached) {
    const ttl = cached.status.valid ? VALID_TTL_MS : INVALID_TTL_MS
    if (Date.now() - cached.at < ttl) {
      return Promise.resolve(cached.status)
    }
  }

  let running = inflight.get(repo)
  if (!running) {
    running = verify(repo).finally(() => inflight.delete(repo))
    inflight.set(repo, running)
  }

  return running
}

export function forgetLicense(repo: string): void {
  cache.delete(repo)
}
