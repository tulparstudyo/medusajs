"use server"

import { listProducts } from "@lib/data/products"
import type { ListingSort } from "@lib/util/listing-params"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"

import type { KibisisProduct } from "../home/data/products"
import { getKibiI18n } from "../i18n/server"
import type { ListingOption } from "./listing-controls"
import { toListingCard } from "./map-product"

const PRODUCT_LIMIT = 12
const FETCH_LIMIT = 100

const SORTS = new Set<ListingSort>(["created_at", "price_asc", "price_desc"])
const MAX_IDS = 100
const OPTION_SEPARATOR = ":"

export type ListingRequest = {
  countryCode: string
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

const ids = (values: unknown) =>
  Array.isArray(values)
    ? values
        .filter((value): value is string => typeof value === "string")
        .slice(0, MAX_IDS)
    : []

const optionToken = (title: string, value: string) =>
  `${title}${OPTION_SEPARATOR}${value}`

function parseSelection(tokens: string[]) {
  const selection = new Map<string, Set<string>>()

  for (const token of tokens) {
    const separator = token.indexOf(OPTION_SEPARATOR)
    const title = token.slice(0, separator).trim()
    const value = token.slice(separator + 1).trim()

    if (separator < 1 || !title || !value) {
      continue
    }

    if (!selection.has(title)) {
      selection.set(title, new Set())
    }
    selection.get(title)!.add(value)
  }

  return selection
}

function variantValues(product: HttpTypes.StoreProduct) {
  const titles = new Map<string, string>()
  for (const option of product.options ?? []) {
    const title = option.title?.trim()
    if (option.id && title) {
      titles.set(option.id, title)
    }
  }

  return (product.variants ?? []).map((variant) => {
    const values = new Map<string, string>()
    for (const optionValue of variant.options ?? []) {
      const optionId = optionValue.option_id ?? optionValue.option?.id
      const title = optionId ? titles.get(optionId) : undefined
      const value = optionValue.value?.trim()
      if (title && value) {
        values.set(title, value)
      }
    }
    return values
  })
}

function matchesSelection(
  product: HttpTypes.StoreProduct,
  selection: Map<string, Set<string>>
) {
  if (!selection.size) {
    return true
  }

  return variantValues(product).some((values) =>
    Array.from(selection).every(([title, wanted]) =>
      wanted.has(values.get(title) ?? "")
    )
  )
}

function collectOptions(products: HttpTypes.StoreProduct[]): ListingOption[] {
  const groups = new Map<string, Set<string>>()

  for (const product of products) {
    const used = new Set(
      variantValues(product).flatMap((values) =>
        Array.from(values, ([title, value]) => optionToken(title, value))
      )
    )

    for (const option of product.options ?? []) {
      const title = option.title?.trim()
      if (!title) {
        continue
      }

      for (const optionValue of option.values ?? []) {
        const value = optionValue.value?.trim()
        if (!value || !used.has(optionToken(title, value))) {
          continue
        }
        if (!groups.has(title)) {
          groups.set(title, new Set())
        }
        groups.get(title)!.add(value)
      }
    }
  }

  return Array.from(groups, ([title, values]) => ({
    id: title,
    title,
    values: orderValues(Array.from(values)).map((value) => ({
      id: optionToken(title, value),
      label: value,
    })),
  }))
}

const isNumeric = (value: string) => /^\d+([.,]\d+)?$/.test(value)

const numberOf = (value: string) => Number(value.replace(",", "."))

function orderValues(values: string[]) {
  const numeric = values
    .filter(isNumeric)
    .sort((a, b) => numberOf(a) - numberOf(b))
  return [...values.filter((value) => !isNumeric(value)), ...numeric]
}

export async function loadListingPage(
  request: ListingRequest,
  page: number
): Promise<ListingPage> {
  const pageNumber = Number.isInteger(page) && page > 0 ? page : 1
  const sortBy =
    request.sortBy && SORTS.has(request.sortBy) ? request.sortBy : "created_at"
  const collectionIds = ids(request.collectionIds)
  const q = typeof request.q === "string" ? request.q.slice(0, 200) : undefined
  const selection = parseSelection(ids(request.optionValueIds))

  const { t } = await getKibiI18n()
  const {
    response: { products },
  } = await listProducts({
    pageParam: 1,
    queryParams: {
      limit: FETCH_LIMIT,
      category_id: ids(request.categoryIds),
      ...(collectionIds.length ? { collection_id: collectionIds } : {}),
      ...(q ? { q } : {}),
    },
    countryCode: String(request.countryCode),
    cache: "no-store",
  })

  // Products without a price in this region get no card, so they are dropped
  // before paging; otherwise pages come back short and leave gaps in the grid.
  const listable = sortProducts(products, sortBy).flatMap((product) => {
    const card = toListingCard(product, t)
    return card ? [{ product, card }] : []
  })
  const matching = listable.filter(({ product }) =>
    matchesSelection(product, selection)
  )
  const offset = (pageNumber - 1) * PRODUCT_LIMIT

  return {
    page: pageNumber,
    cards: matching
      .slice(offset, offset + PRODUCT_LIMIT)
      .map(({ card }) => card),
    count: matching.length,
    totalPages: Math.ceil(matching.length / PRODUCT_LIMIT),
    options: collectOptions(listable.map(({ product }) => product)),
  }
}
