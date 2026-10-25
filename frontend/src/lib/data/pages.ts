import "server-only"

import { sdk } from "@lib/config"

export type StorePageSection = {
  id: string
  type: string
  position: number
  settings: Record<string, unknown>
}

export const getPageSections = async (pageKey: "home" | "product") => {
  try {
    return await sdk.client.fetch<{
      page_key: typeof pageKey
      sections: StorePageSection[]
    }>(`/store/kibipage/${pageKey}`, { cache: "no-store" })
  } catch {
    return { page_key: pageKey, sections: [] as StorePageSection[] }
  }
}
