/** Which URL params of an admin table are filters, and how each is passed to the list API. */
export type TableQuerySpec = {
  /** Comma separated ids, sent as `key[]=a&key[]=b`. */
  lists?: readonly string[]
  /** "true" / "false" (optionally JSON encoded), sent as `key=true`. */
  booleans?: readonly string[]
  /** JSON operator maps such as {"$gte": "..."}, sent as `key[$gte]=...`. */
  dates?: readonly string[]
}

function readBoolean(raw: string): boolean | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === "boolean") {
      return parsed
    }
    if (parsed === "true" || parsed === "false") {
      return parsed === "true"
    }
  } catch {
    if (raw === "true" || raw === "false") {
      return raw === "true"
    }
  }
  return undefined
}

/**
 * Rebuilds an admin table's filters (read from its URL) as a list API query,
 * so the same records can be listed page by page. Paging and sorting params
 * are left out on purpose.
 */
export function tableListQuery(tableParams: URLSearchParams, spec: TableQuerySpec): URLSearchParams {
  const query = new URLSearchParams()

  const q = tableParams.get("q")?.trim()
  if (q) {
    query.set("q", q)
  }

  for (const key of spec.lists ?? []) {
    for (const value of tableParams.get(key)?.split(",") ?? []) {
      if (value.trim()) {
        query.append(`${key}[]`, value.trim())
      }
    }
  }

  for (const key of spec.booleans ?? []) {
    const raw = tableParams.get(key)
    const value = raw === null ? undefined : readBoolean(raw)
    if (value !== undefined) {
      query.set(key, String(value))
    }
  }

  for (const key of spec.dates ?? []) {
    const raw = tableParams.get(key)
    if (!raw) {
      continue
    }

    try {
      const range = JSON.parse(raw) as Record<string, unknown>
      for (const [operator, value] of Object.entries(range)) {
        if (typeof value === "string" || typeof value === "number") {
          query.set(`${key}[${operator}]`, String(value))
        }
      }
    } catch {
      continue
    }
  }

  return query
}

/** True when the table shows every record, i.e. no filter is applied. */
export function isUnfiltered(query: URLSearchParams): boolean {
  return [...query.keys()].length === 0
}

export const PRODUCT_TABLE_QUERY: TableQuerySpec = {
  lists: ["status", "tag_id", "type_id", "category_id", "collection_id", "sales_channel_id"],
  booleans: ["is_giftcard"],
  dates: ["created_at", "updated_at"],
}

export const COLLECTION_TABLE_QUERY: TableQuerySpec = {
  dates: ["created_at", "updated_at"],
}

export const CATEGORY_TABLE_QUERY: TableQuerySpec = {}

export const PRODUCT_OPTION_TABLE_QUERY: TableQuerySpec = {
  booleans: ["is_exclusive"],
  dates: ["created_at", "updated_at"],
}
