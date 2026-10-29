import { HttpTypes } from "@medusajs/types"

import type { ListingImageSettings } from "@lib/data/site-settings"
import type { KibisisProduct } from "../home/data/products"
import type { Translate } from "../i18n"

function cheapest(product: HttpTypes.StoreProduct) {
  let best: {
    price: number
    original: number
    variantId: string
    currency?: string
  } | null = null

  for (const variant of product.variants ?? []) {
    const amount = variant.calculated_price?.calculated_amount
    if (typeof amount !== "number" || !variant.id) {
      continue
    }

    const original =
      typeof variant.calculated_price?.original_amount === "number"
        ? variant.calculated_price.original_amount
        : amount

    if (!best || amount < best.price) {
      best = {
        price: amount,
        original,
        variantId: variant.id,
        currency: variant.calculated_price?.currency_code ?? undefined,
      }
    }
  }

  return best
}

function applyListingImageDimensions(
  url: string,
  dimensions?: ListingImageSettings
): string {
  const width = dimensions?.listing_image_width ?? 0
  const height = dimensions?.listing_image_height ?? 0
  if (!url || (width <= 0 && height <= 0)) {
    return url
  }

  try {
    const isRelative = url.startsWith("/") && !url.startsWith("//")
    const parsed = isRelative ? new URL(url, "http://cdn") : new URL(url)
    if (width > 0) {
      parsed.searchParams.set("w", String(width))
    }
    if (height > 0) {
      parsed.searchParams.set("h", String(height))
    }
    return isRelative
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString()
  } catch {
    const params = new URLSearchParams()
    if (width > 0) {
      params.set("w", String(width))
    }
    if (height > 0) {
      params.set("h", String(height))
    }
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}${params.toString()}`
  }
}

export function toListingCard(
  product: HttpTypes.StoreProduct,
  t: Translate,
  imageSettings?: ListingImageSettings
): KibisisProduct | null {
  const price = cheapest(product)
  if (!price || !product.id) {
    return null
  }

  const onSale = price.original > price.price
  const rawImage = product.thumbnail || product.images?.[0]?.url || ""

  return {
    id: product.id,
    handle: product.handle ?? "",
    variantId: price.variantId,
    name: product.title ?? "",
    title: product.title ?? "",
    price: price.price,
    oldPrice: onSale ? price.original : undefined,
    currency: price.currency,
    image: applyListingImageDimensions(rawImage, imageSettings),
    imageAlt: product.title ?? "",
    rating: "—",
    reviews: "",
    note: "",
    noteClass: "text-slate-400",
    badge: onSale ? t("badge.sale") : t("badge.product"),
    badgeClass: onSale ? "bg-rose-500" : "bg-slate-500",
  }
}
