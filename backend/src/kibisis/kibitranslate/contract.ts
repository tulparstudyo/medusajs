/**
 * Kibisis translation provider contract. Each provider ships a client that
 * speaks the provider's HTTP API and an adapter that maps shop-neutral
 * requests to the provider's documents and back. Callers never talk to a
 * provider directly; they go through the translator (see translator.ts),
 * which works for any content: page sections, products, categories, menus.
 */

/** `html` keeps tags and attributes untouched and translates only the text. */
export type TranslateFormat = "text" | "html"

export type TranslateRequest = {
  texts: string[]
  /** BCP 47 locale code of the texts, e.g. tr-TR. */
  source: string
  /** BCP 47 locale code to translate into, e.g. en-US. */
  target: string
  format?: TranslateFormat
  /**
   * What the texts are, e.g. "product titles" or "navigation menu labels".
   * Providers that understand instructions use it to pick the right tone.
   */
  context?: string
}

export type TranslateDocument = Record<string, unknown>

export type ProviderConfig = {
  credentials: Record<string, string>
}

export type ProviderCredential = {
  key: string
  label: string
  placeholder?: string
  hint?: string
}

/** Speaks the provider's wire protocol and returns its raw documents. */
export interface TranslateClient {
  translate(payload: TranslateDocument): Promise<TranslateDocument>
}

/** Maps shop-neutral requests to the provider's documents and back. */
export interface TranslateAdapter {
  /** Largest number of texts the provider accepts in one call. */
  readonly maxBatch: number
  /** Largest total text length sent in one call; a longer single text goes alone. */
  readonly maxChars: number
  toTranslate(request: TranslateRequest): TranslateDocument
  /** Returns one text per request text, in order; "" when the provider skipped it. */
  fromTranslate(request: TranslateRequest, response: TranslateDocument): string[]
}

export type ProviderDefinition = {
  id: string
  label: string
  credentials: ProviderCredential[]
  /** Whether the stored credentials are enough to call the provider. */
  isConfigured(config: ProviderConfig): boolean
  createClient(config: ProviderConfig): TranslateClient
  adapter: TranslateAdapter
}

export class TranslateError extends Error {
  readonly code: string

  constructor(message: string, code = "translate_error") {
    super(message)
    this.name = "TranslateError"
    this.code = code
  }
}
