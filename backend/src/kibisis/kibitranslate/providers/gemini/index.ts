import { ProviderDefinition } from "../../contract"
import { geminiAdapter } from "./adapter"
import { GeminiClient } from "./client"

export const geminiProvider: ProviderDefinition = {
  id: "gemini",
  label: "Google Gemini",
  credentials: [
    {
      key: "api_key",
      label: "API anahtarı",
      hint: "Google AI Studio'dan alınan Gemini API anahtarı.",
    },
    { key: "model", label: "Model", placeholder: "gemini-flash-latest" },
  ],
  isConfigured: (config) => !!config.credentials.api_key?.trim(),
  createClient: (config) => new GeminiClient(config),
  adapter: geminiAdapter,
}
