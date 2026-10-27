import {
  TranslateAdapter,
  TranslateDocument,
  TranslateError,
  TranslateRequest,
} from "../../contract"

/** Google expects ISO 639 codes; Chinese is the exception that keeps a script region. */
export function googleLanguage(locale: string): string {
  const [language, ...rest] = locale.trim().replace("_", "-").split("-")
  const lower = language.toLowerCase()

  if (lower === "zh") {
    const region = rest.join("-").toUpperCase()
    return region === "TW" || region === "HK" || region === "HANT" ? "zh-TW" : "zh-CN"
  }

  return lower
}

export const googleAdapter: TranslateAdapter = {
  maxBatch: 128,
  maxChars: 25_000,

  toTranslate(request: TranslateRequest): TranslateDocument {
    return {
      q: request.texts,
      source: googleLanguage(request.source),
      target: googleLanguage(request.target),
      format: request.format === "html" ? "html" : "text",
    }
  },

  fromTranslate(request: TranslateRequest, response: TranslateDocument): string[] {
    const data = response.data as { translations?: unknown } | undefined
    const translations = Array.isArray(data?.translations) ? data.translations : null

    if (!translations || translations.length !== request.texts.length) {
      throw new TranslateError(
        "Google Translate gönderilen metin sayısı kadar çeviri döndürmedi.",
        "invalid_response"
      )
    }

    return translations.map((item) => {
      const text = (item as { translatedText?: unknown })?.translatedText
      if (typeof text !== "string") {
        throw new TranslateError("Google Translate yanıtında çeviri metni yok.", "invalid_response")
      }
      return text
    })
  },
}
