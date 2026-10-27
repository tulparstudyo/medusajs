import { HttpTypes } from "@medusajs/types"

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

export function toListingCard(
  product: HttpTypes.StoreProduct,
  t: Translate
): KibisisProduct | null {
  const price = cheapest(product)
  if (!price || !product.id) {
    return null
  }

  const onSale = price.original > price.price

  return {
    id: product.id,
    handle: product.handle ?? "",
    variantId: price.variantId,
    name: product.title ?? "",
    title: product.title ?? "",
    price: price.price,
    oldPrice: onSale ? price.original : undefined,
    currency: price.currency,
    image: product.thumbnail || product.images?.[0]?.url || "",
    imageAlt: product.title ?? "",
    rating: "—",
    reviews: "",
    note: "",
    noteClass: "text-slate-400",
    badge: onSale ? t("badge.sale") : t("badge.product"),
    badgeClass: onSale ? "bg-rose-500" : "bg-slate-500",
  }
}
