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

export type DefaultStorePageKey = (typeof STORE_PAGE_KEYS)[number]

export type StorePageKey = string

export const STORE_PAGE_LABELS: Record<DefaultStorePageKey, string> = {
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

export type StorePageData = {
  page_key: StorePageKey
  label: string
  sections: StorePageSection[]
  exists: boolean
}

const PAGE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const isStorePageKey = (value: string): value is StorePageKey => {
  const trimmed = value.trim()
  return (
    trimmed.length >= 1 &&
    trimmed.length <= 80 &&
    PAGE_KEY_PATTERN.test(trimmed)
  )
}

export const defaultStorePageLabel = (key: string): string =>
  (STORE_PAGE_KEYS as readonly string[]).includes(key)
    ? STORE_PAGE_LABELS[key as DefaultStorePageKey]
    : key

export const getPageSections = async (
  pageKey: StorePageKey
): Promise<StorePageData> => {
  if (!isStorePageKey(pageKey)) {
    return {
      page_key: pageKey,
      label: defaultStorePageLabel(pageKey),
      sections: [],
      exists: false,
    }
  }

  try {
    const response = await sdk.client.fetch<{
      page_key: StorePageKey
      label?: string
      sections: StorePageSection[]
    }>(`/store/kibipage/${encodeURIComponent(pageKey)}`, { cache: "no-store" })

    return {
      page_key: response.page_key,
      label: (response.label ?? "").trim() || defaultStorePageLabel(pageKey),
      sections: response.sections ?? [],
      exists: true,
    }
  } catch {
    return {
      page_key: pageKey,
      label: defaultStorePageLabel(pageKey),
      sections: [],
      exists: false,
    }
  }
}

