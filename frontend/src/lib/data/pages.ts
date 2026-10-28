import "server-only"

import { sdk } from "@lib/config"

export const STORE_PAGE_KEYS = [
  "home",
  "product",
  "cookiepolicy",
  "privacy",
  "terms",
  "contact",
  "about",
  "faq",
  "careers",
] as const

export type StorePageKey = (typeof STORE_PAGE_KEYS)[number]

export const STORE_PAGE_LABELS: Record<StorePageKey, string> = {
  home: "Ana Sayfa",
  product: "Ürün Detay",
  cookiepolicy: "Çerez Politikası",
  privacy: "Gizlilik Politikası",
  terms: "Kullanım Koşulları",
  contact: "İletişim",
  about: "Hakkımızda",
  faq: "S.S.S.",
  careers: "İş İlanları",
}

export type StorePageSection = {
  id: string
  type: string
  position: number
  settings: Record<string, unknown>
}

export const isStorePageKey = (value: string): value is StorePageKey =>
  (STORE_PAGE_KEYS as readonly string[]).includes(value)

export const getPageSections = async (pageKey: StorePageKey) => {
  try {
    return await sdk.client.fetch<{
      page_key: StorePageKey
      sections: StorePageSection[]
    }>(`/store/kibipage/${pageKey}`, { cache: "no-store" })
  } catch {
    return { page_key: pageKey, sections: [] as StorePageSection[] }
  }
}
