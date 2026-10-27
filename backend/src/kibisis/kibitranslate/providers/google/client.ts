import {
  ProviderConfig,
  TranslateClient,
  TranslateDocument,
  TranslateError,
} from "../../contract"
import type { GoogleAuthMode } from "../../../kibisettings/types"
import { parseServiceAccount, serviceAccountToken, ServiceAccount } from "./auth"

export const GOOGLE_TRANSLATE_ENDPOINT =
  "https://translation.googleapis.com/language/translate/v2"

const TIMEOUT_MS = 20_000

type Fetch = typeof fetch

type GoogleErrorBody = {
  error?: { message?: string; status?: string }
}

export function googleAuthMode(config: ProviderConfig): GoogleAuthMode {
  return config.credentials.auth === "service_account" ? "service_account" : "api_key"
}

/**
 * GoogleTranslateClient calls the Cloud Translation API (Basic, v2) with
 * either an API key or an OAuth2 token of a service account.
 */
export class GoogleTranslateClient implements TranslateClient {
  private readonly apiKey: string = ""
  private readonly account: ServiceAccount | null = null

  constructor(
    config: ProviderConfig,
    private readonly fetchImpl: Fetch = fetch
  ) {
    if (googleAuthMode(config) === "service_account") {
      const json = config.credentials.service_account?.trim() ?? ""
      if (!json) {
        throw new TranslateError("Google hizmet hesabı anahtarı girilmemiş.", "credentials_missing")
      }
      this.account = parseServiceAccount(json)
      return
    }

    const apiKey = config.credentials.api_key?.trim() ?? ""
    if (!apiKey) {
      throw new TranslateError("Google Translate API anahtarı girilmemiş.", "credentials_missing")
    }
    this.apiKey = apiKey
  }

  async translate(payload: TranslateDocument): Promise<TranslateDocument> {
    const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" }
    let url = GOOGLE_TRANSLATE_ENDPOINT
    if (this.account) {
      headers.authorization = `Bearer ${await serviceAccountToken(this.account, this.fetchImpl)}`
    } else {
      url = `${GOOGLE_TRANSLATE_ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`
    }

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new TranslateError(`Google Translate servisine ulaşılamadı: ${reason}`, "network_error")
    }

    const text = await response.text()
    let body: unknown
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      throw new TranslateError(
        `Google Translate yanıtı okunamadı (HTTP ${response.status}).`,
        "invalid_response"
      )
    }

    if (!response.ok) {
      const message = (body as GoogleErrorBody).error?.message
      const hint =
        response.status === 401 && !this.account
          ? " Bu anahtar Cloud Translation API için kabul edilmiyor. Google AI Studio'dan alınmış bir Gemini anahtarıysa Site Ayarları → AI Çeviri'de hizmet olarak \"Google Gemini\"yi seçin; değilse kimlik doğrulamayı \"Hizmet hesabı\" yapın."
          : ""
      throw new TranslateError(
        `Google Translate hatası (HTTP ${response.status})${message ? `: ${message}` : "."}${hint}`,
        response.status === 400 || response.status === 401 || response.status === 403
          ? "rejected"
          : "provider_error"
      )
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new TranslateError("Google Translate beklenmeyen yanıt döndü.", "invalid_response")
    }

    return body as TranslateDocument
  }
}
