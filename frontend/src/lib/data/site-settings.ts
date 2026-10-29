import "server-only"

import { cache } from "react"

import { sdk } from "@lib/config"

export type SocialSettings = {
  instagram: string
  youtube: string
  tiktok: string
  facebook: string
  x: string
  linkedin: string
  app_store: string
  google_play: string
  app_gallery: string
}

export type ContactSettings = {
  store_name: string
  legal_name: string
  email: string
  phone: string
  whatsapp: string
  address: string
}

export type ListingImageSettings = {
  listing_image_width: number
  listing_image_height: number
}

const EMPTY_SOCIAL: SocialSettings = {
  instagram: "",
  youtube: "",
  tiktok: "",
  facebook: "",
  x: "",
  linkedin: "",
  app_store: "",
  google_play: "",
  app_gallery: "",
}

const EMPTY_CONTACT: ContactSettings = {
  store_name: "",
  legal_name: "",
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
}

const EMPTY_LISTING_IMAGE: ListingImageSettings = {
  listing_image_width: 0,
  listing_image_height: 0,
}

async function readGroup<T extends Record<string, string>>(key: string, empty: T): Promise<T> {
  try {
    const response = await sdk.client.fetch<{ values: Partial<T> }>(
      `/store/kibisettings/${key}`,
      { cache: "no-store" }
    )
    const values = { ...empty }
    for (const field of Object.keys(empty) as (keyof T)[]) {
      const value = response.values?.[field]
      if (typeof value === "string") {
        values[field] = value.trim() as T[keyof T]
      }
    }
    return values
  } catch {
    return empty
  }
}

function clampDimension(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0
  }
  const truncated = Math.trunc(value)
  if (truncated <= 0) {
    return 0
  }
  return Math.min(4096, truncated)
}

export const getSocialSettings = cache(() => readGroup("social", EMPTY_SOCIAL))

export const getContactSettings = cache(() => readGroup("store", EMPTY_CONTACT))

export const getListingImageSettings = cache(async (): Promise<ListingImageSettings> => {
  try {
    const response = await sdk.client.fetch<{ values: Partial<ListingImageSettings> }>(
      `/store/kibisettings/store`,
      { cache: "no-store" }
    )
    return {
      listing_image_width: clampDimension(response.values?.listing_image_width),
      listing_image_height: clampDimension(response.values?.listing_image_height),
    }
  } catch {
    return EMPTY_LISTING_IMAGE
  }
})

const DEFAULT_STORE_NAME = "VipNova"

export function storeName(contact: ContactSettings): string {
  return contact.store_name || DEFAULT_STORE_NAME
}

export function storeInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)
  return letters.toLocaleUpperCase("tr-TR")
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}

export function whatsappHref(number: string): string {
  let digits = number.replace(/\D/g, "")
  if (digits.startsWith("0")) {
    digits = `9${digits}`
  } else if (digits.length === 10 && digits.startsWith("5")) {
    digits = `90${digits}`
  }
  return `https://wa.me/${digits}`
}
