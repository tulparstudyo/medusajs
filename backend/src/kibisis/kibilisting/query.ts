import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

import { LISTING_VIEW } from "./view"

export const LISTING_SORTS = ["created_at", "price_asc", "price_desc"] as const

export type ListingSort = (typeof LISTING_SORTS)[number]

export type ListingQuery = {
  categoryIds: string[]
  collectionIds: string[]
  salesChannelIds: string[]
  currencyCode: string
  options: { title: string; values: string[] }[]
  q?: string
  sort: ListingSort
  limit: number
  offset: number
}

export type ListingFacet = {
  title: string
  values: { value: string; count: number }[]
}

export type ListingResult = {
  product_ids: string[]
  count: number
  facets: ListingFacet[]
}

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 100
const MAX_OFFSET = 100_000
const MAX_IDS = 100
const MAX_OPTIONS = 100
const MAX_TEXT = 200
const OPTION_SEPARATOR = ":"

const ORDER: Record<ListingSort, string> = {
  created_at: "created_at DESC, product_id DESC",
  price_asc: "price ASC, product_id ASC",
  price_desc: "price DESC, product_id DESC",
}

type Database = {
  raw: (
    sql: string,
    bindings: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>
}

const strings = (value: unknown, max: number) =>
  (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, MAX_TEXT))
    .filter(Boolean)
    .slice(0, max)

const integer = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback
}

// "<option title>:<value>" tokens. Imported products each carry their own
// exclusive options, so option value ids never match across products.
function parseOptions(tokens: string[]) {
  const groups = new Map<string, Set<string>>()

  for (const token of tokens) {
    const separator = token.indexOf(OPTION_SEPARATOR)
    const title = token.slice(0, separator).trim()
    const value = token.slice(separator + 1).trim()

    if (separator < 1 || !title || !value) {
      continue
    }
    if (!groups.has(title)) {
      groups.set(title, new Set())
    }
    groups.get(title)!.add(value)
  }

  return Array.from(groups, ([title, values]) => ({
    title,
    values: Array.from(values),
  }))
}

export function parseListingQuery(
  raw: Record<string, unknown>,
  salesChannelIds: string[]
): ListingQuery {
  const currencyCode = String(raw.currency_code ?? "").trim().toLowerCase()
  if (!/^[a-z]{3}$/.test(currencyCode)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "currency_code must be a three-letter currency code"
    )
  }

  const sort = LISTING_SORTS.includes(raw.sort as ListingSort)
    ? (raw.sort as ListingSort)
    : "created_at"
  const q = strings(raw.q, 1)[0]

  return {
    categoryIds: strings(raw.category_id, MAX_IDS),
    collectionIds: strings(raw.collection_id, MAX_IDS),
    salesChannelIds,
    currencyCode,
    options: parseOptions(strings(raw.option, MAX_OPTIONS)),
    ...(q ? { q } : {}),
    sort,
    limit: integer(raw.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: integer(raw.offset, 0, 0, MAX_OFFSET),
  }
}

const placeholders = (values: unknown[]) => values.map(() => "?").join(", ")

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

// Products matching the category subtree and the non-option filters.
function baseCte(query: ListingQuery) {
  const filters = [
    "currency_code = ?",
    "category_id IN (SELECT id FROM tree)",
    `sales_channel_id IN (${placeholders(query.salesChannelIds)})`,
  ]
  const bindings: unknown[] = [
    ...query.categoryIds,
    query.currencyCode,
    ...query.salesChannelIds,
  ]

  if (query.collectionIds.length) {
    filters.push(`collection_id IN (${placeholders(query.collectionIds)})`)
    bindings.push(...query.collectionIds)
  }

  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`
    filters.push("(title ILIKE ? OR subtitle ILIKE ? OR description ILIKE ?)")
    bindings.push(pattern, pattern, pattern)
  }

  const sql = `
    WITH RECURSIVE tree AS (
      SELECT id FROM product_category
      WHERE id IN (${placeholders(query.categoryIds)})
        AND deleted_at IS NULL AND is_active AND NOT is_internal
      UNION
      SELECT child.id FROM product_category child
      JOIN tree ON child.parent_category_id = tree.id
      WHERE child.deleted_at IS NULL AND child.is_active AND NOT child.is_internal
    ),
    base AS (
      SELECT * FROM ${LISTING_VIEW} WHERE ${filters.join(" AND ")}
    )`

  return { sql, bindings }
}

// Adds the option filter: one variant has to carry a selected value for every
// selected option title (values of the same title are alternatives).
function productsCte(query: ListingQuery) {
  if (!query.options.length) {
    return {
      sql: `,
    products AS (
      SELECT product_id, max(created_at) AS created_at, min(price_amount) AS price
      FROM base GROUP BY product_id
    )`,
      bindings: [] as unknown[],
    }
  }

  const clauses = query.options.map(
    (option) =>
      `(option_title = ? AND option_value IN (${placeholders(option.values)}))`
  )

  return {
    sql: `,
    matched AS (
      SELECT DISTINCT product_id FROM (
        SELECT product_id, variant_id FROM base
        WHERE ${clauses.join(" OR ")}
        GROUP BY product_id, variant_id
        HAVING count(DISTINCT option_title) = ${query.options.length}
      ) variants
    ),
    products AS (
      SELECT product_id, max(created_at) AS created_at, min(price_amount) AS price
      FROM base
      WHERE product_id IN (SELECT product_id FROM matched)
      GROUP BY product_id
    )`,
    bindings: query.options.flatMap((option) => [option.title, ...option.values]),
  }
}

function toFacets(rows: Record<string, unknown>[]): ListingFacet[] {
  const facets = new Map<string, ListingFacet>()

  for (const row of rows) {
    const title = String(row.title)
    if (!facets.has(title)) {
      facets.set(title, { title, values: [] })
    }
    facets.get(title)!.values.push({
      value: String(row.value),
      count: Number(row.count),
    })
  }

  return Array.from(facets.values())
}

export async function runListingQuery(
  container: MedusaContainer,
  query: ListingQuery
): Promise<ListingResult> {
  if (!query.categoryIds.length || !query.salesChannelIds.length) {
    return { product_ids: [], count: 0, facets: [] }
  }

  const database = container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  ) as Database
  const base = baseCte(query)
  const products = productsCte(query)
  const listing = base.sql + products.sql
  const bindings = [...base.bindings, ...products.bindings]

  const [page, total, facets] = await Promise.all([
    database.raw(
      `${listing}
      SELECT product_id FROM products
      ORDER BY ${ORDER[query.sort]}
      LIMIT ? OFFSET ?`,
      [...bindings, query.limit, query.offset]
    ),
    database.raw(
      `${listing}
      SELECT count(*)::int AS count FROM products`,
      bindings
    ),
    database.raw(
      `${base.sql}
      SELECT option_title AS title, option_value AS value,
             count(DISTINCT product_id)::int AS count
      FROM base
      WHERE option_title IS NOT NULL AND option_value IS NOT NULL
      GROUP BY option_title, option_value
      ORDER BY option_title, min(option_rank) NULLS LAST, option_value`,
      base.bindings
    ),
  ])

  return {
    product_ids: page.rows.map((row) => String(row.product_id)),
    count: Number(total.rows[0]?.count ?? 0),
    facets: toFacets(facets.rows),
  }
}
