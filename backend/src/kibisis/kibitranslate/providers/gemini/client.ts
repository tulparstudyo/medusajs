import {
  ProviderConfig,
  TranslateClient,
  TranslateDocument,
  TranslateError,
} from "../../contract"
import { GEMINI_DEFAULT_MODEL } from "../../../kibisettings/types"

export const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

const TIMEOUT_MS = 120_000
const RETRIES = 3
const RETRY_DELAY_MS = 2_000

type Fetch = typeof fetch
type Sleep = (ms: number) => Promise<void>

type GeminiErrorBody = {
  error?: { message?: string; status?: string }
}

const wait: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * GeminiClient sends a prompt to the Gemini generateContent API with an AI
 * Studio API key and returns the response body. Rate limited calls (429)
 * are retried a few times.
 */
export class GeminiClient implements TranslateClient {
  private readonly apiKey: string
  private readonly model: string

  constructor(
    config: ProviderConfig,
    private readonly fetchImpl: Fetch = fetch,
    private readonly sleep: Sleep = wait
  ) {
    const apiKey = config.credentials.api_key?.trim() ?? ""
    if (!apiKey) {
      throw new TranslateError("Gemini API anahtarı girilmemiş.", "credentials_missing")
    }

    this.apiKey = apiKey
    this.model = config.credentials.model?.trim() || GEMINI_DEFAULT_MODEL
  }

  async translate(payload: TranslateDocument): Promise<TranslateDocument> {
    const url = `${GEMINI_API_URL}/models/${encodeURIComponent(this.model)}:generateContent`

    for (let attempt = 1; ; attempt += 1) {
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/json; charset=utf-8",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new TranslateError(`Gemini servisine ulaşılamadı: ${reason}`, "network_error")
      }

      if (response.status === 429 && attempt < RETRIES) {
        await this.sleep(RETRY_DELAY_MS * attempt)
        continue
      }

      const text = await response.text()
      let body: unknown
      try {
        body = text ? JSON.parse(text) : {}
      } catch {
        throw new TranslateError(`Gemini yanıtı okunamadı (HTTP ${response.status}).`, "invalid_response")
      }

      if (!response.ok) {
        const message = (body as GeminiErrorBody).error?.message
        throw new TranslateError(
          `Gemini hatası (HTTP ${response.status})${message ? `: ${message}` : "."}`,
          response.status === 429 ? "rate_limited" : "rejected"
        )
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new TranslateError("Gemini beklenmeyen yanıt döndü.", "invalid_response")
      }

      return body as TranslateDocument
    }
  }
}
