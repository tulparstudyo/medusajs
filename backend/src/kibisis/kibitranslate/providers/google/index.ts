import { ProviderDefinition } from "../../contract"
import { googleAdapter } from "./adapter"
import { googleAuthMode, GoogleTranslateClient } from "./client"

export const googleProvider: ProviderDefinition = {
  id: "google",
  label: "Google Translate",
  credentials: [
    { key: "auth", label: "Kimlik doğrulama" },
    {
      key: "api_key",
      label: "API anahtarı",
      hint: "Google Cloud Console'da Cloud Translation API etkin bir projenin API anahtarı.",
    },
    {
      key: "service_account",
      label: "Hizmet hesabı anahtarı (JSON)",
      hint: "Cloud Translation API User rolü verilmiş hizmet hesabının JSON anahtar dosyası.",
    },
  ],
  isConfigured: (config) =>
    googleAuthMode(config) === "service_account"
      ? !!config.credentials.service_account?.trim()
      : !!config.credentials.api_key?.trim(),
  createClient: (config) => new GoogleTranslateClient(config),
  adapter: googleAdapter,
}
