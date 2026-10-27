import type { TranslateProvider } from "../kibisettings/types"
import { ProviderDefinition } from "./contract"
import { geminiProvider } from "./providers/gemini"
import { googleProvider } from "./providers/google"

export const TRANSLATE_PROVIDER_DEFINITIONS: Record<TranslateProvider, ProviderDefinition> = {
  google: googleProvider,
  gemini: geminiProvider,
}

export function translateProvider(id: string): ProviderDefinition | null {
  return (TRANSLATE_PROVIDER_DEFINITIONS as Record<string, ProviderDefinition>)[id] ?? null
}
