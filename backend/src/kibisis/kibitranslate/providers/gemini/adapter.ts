import {
  TranslateAdapter,
  TranslateDocument,
  TranslateError,
  TranslateRequest,
} from "../../contract"

/** Names the language in English so the model gets an unambiguous instruction. */
export function languageName(locale: string): string {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(locale)
    return name && name !== locale ? `${name} (${locale})` : locale
  } catch {
    return locale
  }
}

function instruction(request: TranslateRequest) {
  return [
    "You are a professional e-commerce translator.",
    request.context ? `The texts are ${request.context}.` : "",
    `The user sends a JSON object. Translate every value from ${languageName(request.source)} to ${languageName(request.target)}.`,
    "Keep the keys unchanged and return a JSON object with exactly the same keys.",
    request.format === "html"
      ? "The values are HTML: translate only the visible text and keep every tag, attribute and entity unchanged."
      : "Preserve Markdown, placeholders such as {name} and line breaks inside the values.",
    "Keep brand and product names as they are. Return only the JSON object.",
  ]
    .filter(Boolean)
    .join(" ")
}

export const geminiAdapter: TranslateAdapter = {
  maxBatch: 50,
  maxChars: 20_000,

  toTranslate(request: TranslateRequest): TranslateDocument {
    const texts: Record<string, string> = {}
    request.texts.forEach((text, index) => {
      texts[String(index)] = text
    })

    return {
      systemInstruction: { parts: [{ text: instruction(request) }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(texts) }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }
  },

  fromTranslate(request: TranslateRequest, response: TranslateDocument): string[] {
    const candidates = response.candidates as
      | { content?: { parts?: { text?: unknown }[] } }[]
      | undefined
    const content = candidates?.[0]?.content?.parts?.[0]?.text

    if (typeof content !== "string" || !content.trim()) {
      throw new TranslateError("Gemini boş yanıt döndürdü.", "invalid_response")
    }

    let translated: unknown
    try {
      translated = JSON.parse(content)
    } catch {
      throw new TranslateError("Gemini geçerli bir JSON döndürmedi.", "invalid_response")
    }

    if (!translated || typeof translated !== "object" || Array.isArray(translated)) {
      throw new TranslateError("Gemini geçerli bir JSON döndürmedi.", "invalid_response")
    }

    const values = translated as Record<string, unknown>
    return request.texts.map((_, index) => {
      const value = values[String(index)]
      return typeof value === "string" ? value.trim() : ""
    })
  },
}
