import { sdk } from "@lib/config"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"

import type { KibisisProduct } from "@theme/kibisis/home/data/products"
import type { StorePageSection } from "../../pages"
import type { MessageKey, Translate } from "@theme/kibisis/i18n"
import { getKibiI18n } from "@theme/kibisis/i18n/server"

const SOURCES = [
  "new",
  "popular",
  "advantageous",
  "discounted",
  "random",
  "editor",
  "tagged",
] as const

type ProductSource = (typeof SOURCES)[number]

type SelectedProductSettings = {
  title: string
  source: ProductSource
  limit: number
  product_ids: string[]
  tag_id: string
  image_width: number
  image_height: number
}

const SOURCE_LABELS: Record<ProductSource, MessageKey> = {
  new: "source.new",
  popular: "source.popular",
  advantageous: "source.advantageous",
  discounted: "source.discounted",
  random: "source.random",
  editor: "source.editor",
  tagged: "source.tagged",
}

const POPULAR_TAGS = new Set(["bestseller", "popüler", "populer", "popular"])

const FIELDS =
  "*variants.calculated_price,+metadata,+tags,*images,+thumbnail"

const sources = new Set<string>(SOURCES)

function parseDimension(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0
  }
  const truncated = Math.trunc(value)
  if (truncated <= 0) {
    return 0
  }
  return Math.min(4096, truncated)
}

export function applyImageDimensions(
  url: string,
  width: number,
  height: number
): string {
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

function readSettings(section: StorePageSection, t: Translate): SelectedProductSettings {
  const settings = section.settings ?? {}
  const sourceValue = settings.source
  const source =
    typeof sourceValue === "string" && sources.has(sourceValue)
      ? (sourceValue as ProductSource)
      : "new"
  const title = typeof settings.title === "string" ? settings.title.trim() : ""
  const limit = typeof settings.limit === "number" ? settings.limit : 8
  const productIds = Array.isArray(settings.product_ids)
    ? settings.product_ids.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    : []
  const tagId = typeof settings.tag_id === "string" ? settings.tag_id : ""
  const imageWidth = parseDimension(settings.image_width)
  const imageHeight = parseDimension(settings.image_height)

  return {
    title: title || t(SOURCE_LABELS[source]),
    source,
    limit: Math.min(24, Math.max(1, Math.trunc(limit) || 8)),
    product_ids: productIds,
    tag_id: tagId,
    image_width: imageWidth,
    image_height: imageHeight,
  }
}

type Priced = { price: number; original: number; variantId: string; currency?: string }

function cheapest(product: HttpTypes.StoreProduct): Priced | null {
  let best: Priced | null = null
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

function discountRatio(product: HttpTypes.StoreProduct) {
  const price = cheapest(product)
  if (!price || price.original <= price.price || price.original <= 0) {
    return 0
  }
  return (price.original - price.price) / price.original
}

function hasPopularTag(product: HttpTypes.StoreProduct) {
  return (product.tags ?? []).some((tag) =>
    POPULAR_TAGS.has((tag.value ?? "").trim().toLocaleLowerCase("tr-TR"))
  )
}

function shuffle<T>(items: T[]) {
  const next = items.slice()
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[swap]
    next[swap] = current
  }
  return next
}

async function fetchProducts(
  regionId: string,
  query: HttpTypes.StoreProductListParams & { limit: number }
) {
  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[]
  }>(`/store/products`, {
    method: "GET",
    query: {
      region_id: regionId,
      fields: FIELDS,
      ...query,
    },
    cache: "no-store",
  })

  return products ?? []
}

function toCard(
  product: HttpTypes.StoreProduct,
  settings: SelectedProductSettings,
  t: Translate
): KibisisProduct | null {
  const price = cheapest(product)
  if (!price) {
    return null
  }

  const { source, image_width: imageWidth, image_height: imageHeight } = settings
  const onSale = price.original > price.price
  const badge = onSale
    ? { badge: t("badge.sale"), badgeClass: "bg-rose-500" }
    : source === "new"
      ? { badge: t("badge.new"), badgeClass: "bg-emerald-500" }
      : source === "popular"
        ? { badge: t("badge.popular"), badgeClass: "bg-orange-500" }
        : source === "advantageous"
          ? { badge: t("badge.deal"), badgeClass: "bg-orange-500" }
          : { badge: t("badge.product"), badgeClass: "bg-slate-500" }

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
    image: applyImageDimensions(rawImage, imageWidth, imageHeight),
    imageAlt: product.title ?? "",
    rating: "—",
    reviews: "",
    note: "",
    noteClass: "text-slate-400",
    ...badge,
  }
}

export async function loadSelectedProducts(
  countryCode: string,
  section: StorePageSection
): Promise<{ title: string; products: KibisisProduct[] } | null> {
  const { t } = await getKibiI18n()
  const settings = readSettings(section, t)
  const region = await getRegion(countryCode)
  if (!region) {
    return null
  }

  let products: HttpTypes.StoreProduct[] = []

  if (settings.source === "editor") {
    if (!settings.product_ids.length) {
      return null
    }
    const listed = await fetchProducts(region.id, {
      id: settings.product_ids,
      limit: settings.product_ids.length,
    })
    const byId = new Map(listed.map((product) => [product.id, product]))
    products = settings.product_ids
      .map((id) => byId.get(id))
      .filter((product): product is HttpTypes.StoreProduct => Boolean(product))
  } else if (settings.source === "tagged") {
    if (!settings.tag_id) {
      return null
    }
    products = await fetchProducts(region.id, {
      tag_id: [settings.tag_id],
      limit: settings.limit,
      order: "-created_at",
    })
  } else {
    const pool = await fetchProducts(region.id, {
      limit: 100,
      order: "-created_at",
    })
    if (settings.source === "popular") {
      products = pool.filter(hasPopularTag)
    } else if (settings.source === "advantageous") {
      products = pool
        .filter((product) => discountRatio(product) > 0)
        .sort((left, right) => discountRatio(right) - discountRatio(left))
    } else if (settings.source === "discounted") {
      products = pool.filter((product) => discountRatio(product) > 0)
    } else if (settings.source === "random") {
      products = shuffle(pool)
    } else {
      products = pool
    }
  }

  const cards = products
    .slice(0, settings.limit)
    .map((product) => toCard(product, settings, t))
    .filter((product): product is KibisisProduct => Boolean(product))

  if (!cards.length) {
    return null
  }

  return { title: settings.title, products: cards }
}
