import { generateKeyPairSync, createVerify } from "node:crypto"

import { MedusaError } from "@medusajs/framework/utils"

import { TranslateError } from "../contract"
import { batchesOf, translateRecords, translateStatus, translateTexts } from "../translator"
import { memoryHash } from "../memory"
import { googleAdapter, googleLanguage } from "../providers/google/adapter"
import {
  forgetServiceAccountTokens,
  GOOGLE_TOKEN_URL,
  GOOGLE_TRANSLATE_SCOPE,
  parseServiceAccount,
} from "../providers/google/auth"
import { GOOGLE_TRANSLATE_ENDPOINT, GoogleTranslateClient } from "../providers/google/client"
import { googleProvider } from "../providers/google"
import { geminiAdapter, languageName } from "../providers/gemini/adapter"
import { GEMINI_API_URL, GeminiClient } from "../providers/gemini/client"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const SERVICE_ACCOUNT = JSON.stringify({
  type: "service_account",
  client_email: "translate@demo.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  token_uri: GOOGLE_TOKEN_URL,
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

type StoredEntry = { source: string; target: string; format: "text" | "html"; text: string; translated: string }

function memoryStub(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    recall: jest.fn(async (hashes: string[]) =>
      new Map(hashes.filter((hash) => store.has(hash)).map((hash) => [hash, store.get(hash)!]))
    ),
    remember: jest.fn(async (entries: StoredEntry[]) => {
      for (const entry of entries) {
        if (entry.translated) {
          store.set(memoryHash(entry), entry.translated)
        }
      }
    }),
  }
}

function containerWith(settings: Record<string, unknown>, memory = memoryStub()) {
  return {
    resolve: <T>(key: string) =>
      (key === "kibitranslate"
        ? memory
        : {
            getSecretSettings: async () => ({
              enabled: true,
              provider: "google",
              google_auth: "api_key",
              google_api_key: "key-1",
              google_service_account: "",
              ...settings,
            }),
          }) as T,
  }
}

describe("google translate adapter", () => {
  it("maps locales to Google language codes", () => {
    expect(googleLanguage("tr-TR")).toBe("tr")
    expect(googleLanguage("en-US")).toBe("en")
    expect(googleLanguage("ru")).toBe("ru")
    expect(googleLanguage("zh-TW")).toBe("zh-TW")
    expect(googleLanguage("zh-CN")).toBe("zh-CN")
  })

  it("builds the request and reads translations in order", () => {
    const request = { texts: ["Merhaba", "Sepet"], source: "tr-TR", target: "ru-RU" }

    expect(googleAdapter.toTranslate(request)).toEqual({
      q: ["Merhaba", "Sepet"],
      source: "tr",
      target: "ru",
      format: "text",
    })
    expect(
      googleAdapter.fromTranslate(request, {
        data: { translations: [{ translatedText: "Привет" }, { translatedText: "Корзина" }] },
      })
    ).toEqual(["Привет", "Корзина"])
  })

  it("asks Google to keep HTML markup for html requests", () => {
    expect(
      googleAdapter.toTranslate({ texts: ["<p>Merhaba</p>"], source: "tr", target: "en", format: "html" })
    ).toMatchObject({ format: "html" })
  })

  it("rejects a response with a different number of texts", () => {
    const request = { texts: ["a", "b"], source: "tr", target: "en" }
    expect(() =>
      googleAdapter.fromTranslate(request, { data: { translations: [{ translatedText: "a" }] } })
    ).toThrow(TranslateError)
  })
})

describe("google translate client", () => {
  it("requires an API key", () => {
    expect(() => new GoogleTranslateClient({ credentials: { api_key: " " } })).toThrow(
      "Google Translate API anahtarı girilmemiş."
    )
  })

  it("posts JSON with the API key and returns the body", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(200, { data: { translations: [{ translatedText: "Hello" }] } })
    )
    const client = new GoogleTranslateClient({ credentials: { api_key: "a b" } }, fetchImpl as typeof fetch)

    const body = await client.translate({ q: ["Merhaba"], source: "tr", target: "en", format: "text" })

    expect(body).toEqual({ data: { translations: [{ translatedText: "Hello" }] } })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${GOOGLE_TRANSLATE_ENDPOINT}?key=a%20b`)
    expect(init.method).toBe("POST")
    expect(JSON.parse(String(init.body))).toEqual({ q: ["Merhaba"], source: "tr", target: "en", format: "text" })
  })

  it("surfaces the provider error message", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(403, { error: { message: "API key not valid." } })
    )
    const client = new GoogleTranslateClient({ credentials: { api_key: "bad" } }, fetchImpl as typeof fetch)

    await expect(client.translate({ q: ["x"] })).rejects.toThrow(
      "Google Translate hatası (HTTP 403): API key not valid."
    )
  })

  it("explains what to do when the API key is not accepted", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(401, { error: { message: "API keys are not supported by this API." } })
    )
    const client = new GoogleTranslateClient({ credentials: { api_key: "k" } }, fetchImpl as typeof fetch)

    await expect(client.translate({ q: ["x"] })).rejects.toThrow(/Hizmet hesabı/)
  })
})

describe("google service account auth", () => {
  beforeEach(() => forgetServiceAccountTokens())

  it("validates the key file", () => {
    expect(() => parseServiceAccount("{nope")).toThrow("geçerli bir JSON değil")
    expect(() => parseServiceAccount(JSON.stringify({ type: "authorized_user" }))).toThrow(
      "type, client_email veya private_key eksik"
    )
    expect(parseServiceAccount(SERVICE_ACCOUNT).client_email).toBe(
      "translate@demo.iam.gserviceaccount.com"
    )
  })

  it("signs a JWT, exchanges it for a token and reuses the token", async () => {
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      if (url === GOOGLE_TOKEN_URL) {
        return jsonResponse(200, { access_token: "token-1", expires_in: 3600 })
      }
      return jsonResponse(200, { data: { translations: [{ translatedText: "Hello" }] } })
    })
    const client = new GoogleTranslateClient(
      { credentials: { auth: "service_account", service_account: SERVICE_ACCOUNT } },
      fetchImpl as unknown as typeof fetch
    )

    await client.translate({ q: ["Merhaba"] })
    await client.translate({ q: ["Merhaba"] })

    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][]
    const tokenCalls = calls.filter(([url]) => url === GOOGLE_TOKEN_URL)
    expect(tokenCalls).toHaveLength(1)

    const form = new URLSearchParams(String(tokenCalls[0][1].body))
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer")
    const [header, claims, signature] = String(form.get("assertion")).split(".")
    const verified = createVerify("RSA-SHA256")
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature, "base64url"))
    expect(verified).toBe(true)
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toMatchObject({
      iss: "translate@demo.iam.gserviceaccount.com",
      scope: GOOGLE_TRANSLATE_SCOPE,
      aud: GOOGLE_TOKEN_URL,
    })

    const translateCalls = calls.filter(([url]) => url === GOOGLE_TRANSLATE_ENDPOINT)
    expect(translateCalls).toHaveLength(2)
    expect((translateCalls[0][1].headers as Record<string, string>).authorization).toBe("Bearer token-1")
  })

  it("reports a rejected service account", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(400, { error: "invalid_grant", error_description: "Invalid JWT Signature." }))
    const client = new GoogleTranslateClient(
      { credentials: { auth: "service_account", service_account: SERVICE_ACCOUNT } },
      fetchImpl as unknown as typeof fetch
    )

    await expect(client.translate({ q: ["x"] })).rejects.toThrow(
      "Google hizmet hesabıyla oturum açılamadı (HTTP 400): Invalid JWT Signature."
    )
  })

  it("is configured by the credential of the selected method", () => {
    expect(googleProvider.isConfigured({ credentials: { auth: "api_key", api_key: "k" } })).toBe(true)
    expect(googleProvider.isConfigured({ credentials: { auth: "service_account", api_key: "k" } })).toBe(false)
    expect(
      googleProvider.isConfigured({ credentials: { auth: "service_account", service_account: SERVICE_ACCOUNT } })
    ).toBe(true)
  })
})

describe("gemini provider", () => {
  const request = { texts: ["Merhaba", "Sepet"], source: "tr-TR", target: "ru-RU" }

  it("names languages for the prompt", () => {
    expect(languageName("ru-RU")).toBe("Russian (Russia) (ru-RU)")
  })

  it("sends the texts as a keyed JSON object and asks for JSON back", () => {
    const body = geminiAdapter.toTranslate(request) as {
      systemInstruction: { parts: { text: string }[] }
      contents: { parts: { text: string }[] }[]
      generationConfig: Record<string, unknown>
    }

    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({ "0": "Merhaba", "1": "Sepet" })
    expect(body.systemInstruction.parts[0].text).toContain("from Turkish")
    expect(body.systemInstruction.parts[0].text).toContain("to Russian")
    expect(body.generationConfig).toEqual({ temperature: 0.2, responseMimeType: "application/json" })
  })

  it("tells the model what the texts are and how to treat HTML", () => {
    const body = geminiAdapter.toTranslate({
      ...request,
      format: "html",
      context: "product descriptions",
    }) as { systemInstruction: { parts: { text: string }[] } }
    const prompt = body.systemInstruction.parts[0].text

    expect(prompt).toContain("The texts are product descriptions.")
    expect(prompt).toContain("keep every tag, attribute and entity unchanged")
  })

  it("reads translations by key and leaves missing ones empty", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: '{"0": " Привет ", "2": "x"}' }] } }],
    }
    expect(geminiAdapter.fromTranslate(request, response)).toEqual(["Привет", ""])
    expect(() =>
      geminiAdapter.fromTranslate(request, { candidates: [{ content: { parts: [{ text: "nope" }] } }] })
    ).toThrow("Gemini geçerli bir JSON döndürmedi.")
  })

  it("calls generateContent with the key header and the configured model", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { candidates: [] }))
    const client = new GeminiClient(
      { credentials: { api_key: "ai-key", model: "gemini-2.5-flash" } },
      fetchImpl as unknown as typeof fetch
    )

    await client.translate({ contents: [] })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${GEMINI_API_URL}/models/gemini-2.5-flash:generateContent`)
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("ai-key")
  })

  it("uses the default model and retries rate limited calls", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: "Quota" } }))
      .mockResolvedValueOnce(jsonResponse(200, { candidates: [] }))
    const sleep = jest.fn(async () => undefined)
    const client = new GeminiClient({ credentials: { api_key: "k" } }, fetchImpl, sleep)

    await client.translate({})

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/models/gemini-flash-latest:generateContent")
  })

  it("translates through the gateway when Gemini is selected", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, { candidates: [{ content: { parts: [{ text: '{"0":"Hello"}' }] } }] })
    )

    await expect(
      translateTexts(containerWith({ provider: "gemini", gemini_api_key: "k", gemini_model: "" }), {
        texts: ["Merhaba"],
        source: "tr-TR",
        target: "en-US",
      })
    ).resolves.toEqual(["Hello"])
    jest.restoreAllMocks()
  })
})

describe("translate gateway", () => {
  afterEach(() => jest.restoreAllMocks())

  it("reports whether the selected provider is ready", async () => {
    await expect(translateStatus(containerWith({}))).resolves.toEqual({
      enabled: true,
      provider: "google",
      label: "Google Translate",
      configured: true,
    })
    await expect(translateStatus(containerWith({ google_api_key: "" }))).resolves.toMatchObject({
      configured: false,
    })
  })

  it("refuses to translate while disabled", async () => {
    await expect(
      translateTexts(containerWith({ enabled: false }), { texts: ["a"], source: "tr", target: "en" })
    ).rejects.toThrow(MedusaError)
  })

  it("sends texts in provider-sized batches and keeps their order", async () => {
    const texts = Array.from({ length: 130 }, (_, index) => `metin ${index}`)
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      const { q } = JSON.parse(String(init?.body)) as { q: string[] }
      return jsonResponse(200, {
        data: { translations: q.map((text) => ({ translatedText: text.replace("metin", "text") })) },
      })
    })

    const result = await translateTexts(containerWith({}), { texts, source: "tr-TR", target: "en-US" })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(130)
    expect(result[0]).toBe("text 0")
    expect(result[129]).toBe("text 129")
  })

  it("splits batches by text count and total size", () => {
    expect(batchesOf(["a", "b", "c"], { maxBatch: 2, maxChars: 100 })).toEqual([["a", "b"], ["c"]])
    expect(batchesOf(["aaaa", "bbbb", "cc"], { maxBatch: 10, maxChars: 6 })).toEqual([
      ["aaaa"],
      ["bbbb", "cc"],
    ])
    expect(batchesOf(["x".repeat(50)], { maxBatch: 10, maxChars: 6 })).toHaveLength(1)
  })

  it("sends repeated texts once and keeps blank texts as they are", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      const { q } = JSON.parse(String(init?.body)) as { q: string[] }
      return jsonResponse(200, { data: { translations: q.map((text) => ({ translatedText: `${text}!` })) } })
    })

    const result = await translateTexts(containerWith({}), {
      texts: ["Sepet", "", "Sepet", "Ev"],
      source: "tr",
      target: "en",
    })

    expect(result).toEqual(["Sepet!", "", "Sepet!", "Ev!"])
    const { q } = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)) as { q: string[] }
    expect(q).toEqual(["Sepet", "Ev"])
  })

  it("translates records of any content type and keeps HTML fields apart", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      const { q, format } = JSON.parse(String(init?.body)) as { q: string[]; format: string }
      return jsonResponse(200, {
        data: { translations: q.map((text) => ({ translatedText: `${format}:${text}` })) },
      })
    })

    const records = await translateRecords(containerWith({}), {
      source: "tr-TR",
      target: "en-US",
      htmlFields: ["description"],
      records: [
        { id: "prod_1", fields: { title: "Elbise", description: "<p>Pamuk</p>", subtitle: " " } },
        { id: "prod_2", fields: { title: "" } },
      ],
    })

    expect(records).toEqual([
      { id: "prod_1", fields: { title: "text:Elbise", description: "html:<p>Pamuk</p>" } },
    ])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("hashes a text per language pair and format, ignoring locale spelling", () => {
    const base = { source: "tr-TR", target: "en-US", format: "text" as const, text: "Sepet" }
    expect(memoryHash(base)).toBe(memoryHash({ ...base, source: "tr_tr", target: "EN-us" }))
    expect(memoryHash(base)).not.toBe(memoryHash({ ...base, target: "ru-RU" }))
    expect(memoryHash(base)).not.toBe(memoryHash({ ...base, format: "html" }))
    expect(memoryHash(base)).toMatch(/^[0-9a-f]{64}$/)
  })

  it("serves remembered texts without calling the provider and stores new ones", async () => {
    const remembered = { source: "tr-TR", target: "en-US", format: "text" as const, text: "Sepet" }
    const memory = memoryStub({ [memoryHash(remembered)]: "Cart" })
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      const { q } = JSON.parse(String(init?.body)) as { q: string[] }
      return jsonResponse(200, { data: { translations: q.map((text) => ({ translatedText: `${text}!` })) } })
    })

    const first = await translateTexts(containerWith({}, memory), {
      texts: ["Sepet", "Ev"],
      source: "tr-TR",
      target: "en-US",
    })

    expect(first).toEqual(["Cart", "Ev!"])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const { q } = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)) as { q: string[] }
    expect(q).toEqual(["Ev"])
    expect(memory.remember).toHaveBeenCalledWith([
      { source: "tr-TR", target: "en-US", format: "text", text: "Ev", translated: "Ev!", provider: "google" },
    ])

    const second = await translateTexts(containerWith({}, memory), {
      texts: ["Ev", "Sepet"],
      source: "tr-TR",
      target: "en-US",
    })

    expect(second).toEqual(["Ev!", "Cart"])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("does not need a working provider when every text is remembered", async () => {
    const key = { source: "tr", target: "en", format: "text" as const, text: "Ev" }
    const memory = memoryStub({ [memoryHash(key)]: "Home" })

    await expect(
      translateTexts(containerWith({ google_api_key: "" }, memory), { texts: ["Ev"], source: "tr", target: "en" })
    ).resolves.toEqual(["Home"])
  })

  it("turns provider failures into Medusa errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(400, { error: { message: "Bad language" } }))

    await expect(
      translateTexts(containerWith({}), { texts: ["a"], source: "tr", target: "xx" })
    ).rejects.toThrow("Google Translate hatası (HTTP 400): Bad language")
  })
})
