import {
  OPTION_VALUE_QUERY_KEY,
  parseOptionValueIds,
} from "./product-option-filters"

export const SEARCH_QUERY_KEY = "q"
export const SORT_QUERY_KEY = "sortBy"
export const COLLECTION_QUERY_KEY = "collectionId"

const SORTS = ["created_at", "price_asc", "price_desc"] as const

export type ListingSort = (typeof SORTS)[number]

const SORT_SET = new Set<string>(SORTS)

type SearchParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

const readValues = (searchParams: SearchParamSource, key: string) => {
  if (typeof (searchParams as URLSearchParams).getAll === "function") {
    return Array.from(
      new Set(
        (searchParams as URLSearchParams)
          .getAll(key)
          .flatMap((value) => value.split(","))
          .map((value) => value.trim())
          .filter(Boolean)
      )
    )
  }

  const paramValue = (
    searchParams as Record<string, string | string[] | undefined>
  )[key]

  if (Array.isArray(paramValue)) {
    return Array.from(new Set(paramValue.filter(Boolean)))
  }

  if (typeof paramValue === "string" && paramValue.length > 0) {
    return paramValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  }

  return []
}

const readFirst = (searchParams: SearchParamSource, key: string) => {
  if (typeof (searchParams as URLSearchParams).get === "function") {
    const value = (searchParams as URLSearchParams).get(key)?.trim()
    return value || undefined
  }

  const paramValue = (
    searchParams as Record<string, string | string[] | undefined>
  )[key]
  const value = (Array.isArray(paramValue) ? paramValue[0] : paramValue)?.trim()
  return value || undefined
}

export const parseListingQuery = (searchParams: SearchParamSource) => {
  const sortValue = readFirst(searchParams, SORT_QUERY_KEY)
  const sortBy = sortValue && SORT_SET.has(sortValue)
    ? (sortValue as ListingSort)
    : undefined

  const pageValue = Number.parseInt(readFirst(searchParams, "page") || "", 10)
  const page =
    Number.isFinite(pageValue) && pageValue > 1 ? String(pageValue) : undefined

  return {
    q: readFirst(searchParams, SEARCH_QUERY_KEY),
    sortBy,
    page,
    collectionIds: readValues(searchParams, COLLECTION_QUERY_KEY),
    optionValueIds: parseOptionValueIds(searchParams),
  }
}

export { OPTION_VALUE_QUERY_KEY }
