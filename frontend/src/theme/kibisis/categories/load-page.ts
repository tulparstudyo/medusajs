"use server"

import { sdk } from "@lib/config"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import {
  getListingImageSettings,
  type ListingImageSettings,
} from "@lib/data/site-settings"
import type { ListingSort } from "@lib/util/listing-params"

import type { KibisisProduct } from "../home/data/products"
import type { Translate } from "../i18n"
import { getKibiI18n } from "../i18n/server"
import type { ListingOption } from "./listing-controls"
import { toListingCard } from "./map-product"

const PRODUCT_LIMIT = 12

const SORTS = new Set<ListingSort>(["created_at", "price_asc", "price_desc"])
const MAX_IDS = 100
const OPTION_SEPARATOR = ":"

export type ListingRequest = {
  countryCode: string
  // The backend expands each category to its whole subtree.
  categoryIds: string[]
  collectionIds: string[]
  // "<option title>:<value>" pairs. Imported products each carry their own
  // exclusive options, so value ids never match across products.
  optionValueIds: string[]
  q?: string
  sortBy?: ListingSort
}

export type ListingPage = {
  page: number
  cards: KibisisProduct[]
  count: number
  totalPages: number
  options: ListingOption[]
}

type ListingResponse = {
  product_ids: string[]
  count: number
  facets: { title: string; values: { value: string; count: number }[] }[]
}

const ids = (values: unknown) =>
  Array.isArray(values)
    ? values
        .filter((value): value is string => typeof value === "string")
        .slice(0, MAX_IDS)
    : []

const optionToken = (title: string, value: string) =>
  `${title}${OPTION_SEPARATOR}${value}`

const SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "2XL",
  "XXXL",
  "3XL",
  "4XL",
  "5XL",
]

const isNumeric = (value: string) => /^\d+([.,]\d+)?$/.test(value)

const numberOf = (value: string) => Number(value.replace(",", "."))

const sizeRank = (value: string) => {
  const rank = SIZE_ORDER.indexOf(value.toUpperCase())
  return rank === -1 ? SIZE_ORDER.length : rank
}

// Letter sizes in wearing order, numeric sizes ascending, anything else in the
// order the backend returned it.
function orderValues(values: string[]) {
  const numeric = values
    .filter(isNumeric)
    .sort((a, b) => numberOf(a) - numberOf(b))
  const named = values
    .filter((value) => !isNumeric(value))
    .map((value, index) => ({ value, index }))
    .sort((a, b) => sizeRank(a.value) - sizeRank(b.value) || a.index - b.index)
    .map(({ value }) => value)
  return [...named, ...numeric]
}

function toOptions(facets: ListingResponse["facets"]): ListingOption[] {
  return facets.map(({ title, values }) => ({
    id: title,
    title,
    values: orderValues(values.map(({ value }) => value)).map((value) => ({
      id: optionToken(title, value),
      label: value,
    })),
  }))
}

// The listing endpoint only returns ids, so the cards are read with Medusa's
// own pricing and put back in the order the endpoint sorted them.
async function loadCards(
  productIds: string[],
  countryCode: string,
  t: Translate,
  imageSettings: ListingImageSettings
) {
  if (!productIds.length) {
    return []
  }

  const {
    response: { products },
  } = await listProducts({
    queryParams: { id: productIds, limit: productIds.length },
    countryCode,
  })
  const byId = new Map(products.map((product) => [product.id, product]))

  return productIds.flatMap((id) => {
    const product = byId.get(id)
    const card = product ? toListingCard(product, t, imageSettings) : null
    return card ? [card] : []
  })
}

export async function loadListingPage(
  request: ListingRequest,
  page: number
): Promise<ListingPage> {
  const pageNumber = Number.isInteger(page) && page > 0 ? page : 1
  const sortBy =
    request.sortBy && SORTS.has(request.sortBy) ? request.sortBy : "created_at"
  const collectionIds = ids(request.collectionIds)
  const optionTokens = ids(request.optionValueIds)
  const q = typeof request.q === "string" ? request.q.slice(0, 200) : undefined
  const countryCode = String(request.countryCode)

  const region = await getRegion(countryCode)
  if (!region) {
    return { page: pageNumber, cards: [], count: 0, totalPages: 0, options: [] }
  }

  const [listing, { t }, imageSettings] = await Promise.all([
    sdk.client.fetch<ListingResponse>("/store/kibilisting", {
      method: "GET",
      query: {
        category_id: ids(request.categoryIds),
        ...(collectionIds.length ? { collection_id: collectionIds } : {}),
        ...(optionTokens.length ? { option: optionTokens } : {}),
        ...(q ? { q } : {}),
        sort: sortBy,
        currency_code: region.currency_code,
        limit: PRODUCT_LIMIT,
        offset: (pageNumber - 1) * PRODUCT_LIMIT,
      },
      cache: "no-store",
    }),
    getKibiI18n(),
    getListingImageSettings(),
  ])

  return {
    page: pageNumber,
    cards: await loadCards(listing.product_ids, countryCode, t, imageSettings),
    count: listing.count,
    totalPages: Math.ceil(listing.count / PRODUCT_LIMIT),
    options: toOptions(listing.facets),
  }
}
