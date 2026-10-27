import { createSign } from "node:crypto"

import { TranslateError } from "../../contract"

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const GOOGLE_TRANSLATE_SCOPE = "https://www.googleapis.com/auth/cloud-translation"

const TIMEOUT_MS = 20_000
/** Tokens are renewed this long before Google's expiry. */
const EXPIRY_MARGIN_MS = 60_000

type Fetch = typeof fetch

export type ServiceAccount = {
  client_email: string
  private_key: string
  token_uri: string
}

type CachedToken = { token: string; expiresAt: number }

const tokens = new Map<string, CachedToken>()

/** Parses the JSON key file downloaded from Google Cloud Console. */
export function parseServiceAccount(json: string): ServiceAccount {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new TranslateError("Hizmet hesabı anahtarı geçerli bir JSON değil.", "credentials_invalid")
  }

  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const email = typeof record.client_email === "string" ? record.client_email.trim() : ""
  const key = typeof record.private_key === "string" ? record.private_key : ""
  if (record.type !== "service_account" || !email || !key.includes("PRIVATE KEY")) {
    throw new TranslateError(
      "Hizmet hesabı anahtarında type, client_email veya private_key eksik.",
      "credentials_invalid"
    )
  }

  const tokenUri = typeof record.token_uri === "string" && record.token_uri ? record.token_uri : GOOGLE_TOKEN_URL
  return { client_email: email, private_key: key, token_uri: tokenUri }
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url")
}

export function signedAssertion(account: ServiceAccount, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000)
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: GOOGLE_TRANSLATE_SCOPE,
      aud: account.token_uri,
      iat: issuedAt,
      exp: issuedAt + 3600,
    })
  )
  const unsigned = `${header}.${claims}`

  let signature: Buffer
  try {
    signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key)
  } catch {
    throw new TranslateError("Hizmet hesabı özel anahtarı okunamadı.", "credentials_invalid")
  }

  return `${unsigned}.${base64Url(signature)}`
}

/**
 * Exchanges a signed JWT for an OAuth2 access token (service account flow)
 * and reuses it until shortly before it expires.
 */
export async function serviceAccountToken(account: ServiceAccount, fetchImpl: Fetch): Promise<string> {
  const cacheKey = `${account.client_email}|${account.token_uri}`
  const cached = tokens.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token
  }

  let response: Response
  try {
    response = await fetchImpl(account.token_uri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signedAssertion(account),
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new TranslateError(`Google oturum servisine ulaşılamadı: ${reason}`, "network_error")
  }

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: unknown
    expires_in?: unknown
    error_description?: unknown
    error?: unknown
  }

  if (!response.ok || typeof body.access_token !== "string") {
    const reason = body.error_description ?? body.error
    throw new TranslateError(
      `Google hizmet hesabıyla oturum açılamadı (HTTP ${response.status})${reason ? `: ${String(reason)}` : "."}`,
      "credentials_rejected"
    )
  }

  const seconds = typeof body.expires_in === "number" ? body.expires_in : 3600
  tokens.set(cacheKey, {
    token: body.access_token,
    expiresAt: Date.now() + seconds * 1000 - EXPIRY_MARGIN_MS,
  })

  return body.access_token
}

export function forgetServiceAccountTokens() {
  tokens.clear()
}
