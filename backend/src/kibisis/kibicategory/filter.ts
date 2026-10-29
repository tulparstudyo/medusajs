export type CategoryFilterRow = {
  id: string
  name: string
  parent_category_id?: string | null
  rank?: number | null
}

export type CategoryFilterOption = {
  id: string
  name: string
  path: string
  depth: number
  parentId: string | null
  descendantIds: string[]
}

export function buildCategoryFilterOptions(rows: CategoryFilterRow[]): CategoryFilterOption[] {
  const validRows = rows.filter(
    (row) => typeof row.id === "string" && row.id.trim().length > 0 && typeof row.name === "string" && row.name.trim().length > 0
  )
  const ids = new Set(validRows.map((row) => row.id))
  const children = new Map<string | null, CategoryFilterRow[]>()

  for (const row of validRows) {
    const parentId =
      typeof row.parent_category_id === "string" && ids.has(row.parent_category_id)
        ? row.parent_category_id
        : null
    const siblings = children.get(parentId) ?? []
    siblings.push(row)
    children.set(parentId, siblings)
  }

  const compareRows = (left: CategoryFilterRow, right: CategoryFilterRow) => {
    const leftRank = typeof left.rank === "number" && Number.isFinite(left.rank) ? left.rank : 0
    const rightRank = typeof right.rank === "number" && Number.isFinite(right.rank) ? right.rank : 0
    if (leftRank !== rightRank) {
      return leftRank - rightRank
    }
    return left.name.localeCompare(right.name, "tr")
  }

  for (const siblings of children.values()) {
    siblings.sort(compareRows)
  }

  const options: CategoryFilterOption[] = []
  const seen = new Set<string>()

  const visit = (row: CategoryFilterRow, prefix: string[], parentId: string | null): string[] => {
    if (seen.has(row.id)) {
      return []
    }

    seen.add(row.id)
    const name = row.name.trim()
    const pathSegments = [...prefix, name]
    const descendantIds: string[] = []
    const option: CategoryFilterOption = {
      id: row.id,
      name,
      path: pathSegments.join(" > "),
      depth: prefix.length,
      parentId,
      descendantIds,
    }
    options.push(option)

    for (const child of children.get(row.id) ?? []) {
      const childSubtreeIds = visit(child, pathSegments, row.id)
      descendantIds.push(...childSubtreeIds)
    }

    return [row.id, ...descendantIds]
  }

  for (const root of children.get(null) ?? []) {
    visit(root, [], null)
  }

  const remaining = validRows.filter((row) => !seen.has(row.id)).sort(compareRows)
  for (const row of remaining) {
    visit(row, [], null)
  }

  return options
}

export function categoryFilterQueryIds(
  options: CategoryFilterOption[],
  selectedId: string,
  includeSubcategories: boolean
): string[] {
  const trimmed = selectedId.trim()
  if (!trimmed) {
    return []
  }

  const found = options.find((option) => option.id === trimmed)
  if (!found) {
    return [trimmed]
  }

  if (!includeSubcategories || found.descendantIds.length === 0) {
    return [found.id]
  }

  return [found.id, ...found.descendantIds]
}

export function parseCategoryFilterParam(
  options: CategoryFilterOption[],
  paramValue: string | null | undefined
): { selectedId: string; includeSubcategories: boolean } {
  if (!paramValue) {
    return { selectedId: "", includeSubcategories: true }
  }

  const ids = paramValue
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)

  if (ids.length === 0) {
    return { selectedId: "", includeSubcategories: true }
  }

  const primaryId = ids[0]
  const found = options.find((option) => option.id === primaryId)

  if (!found) {
    return { selectedId: primaryId, includeSubcategories: ids.length > 1 }
  }

  if (found.descendantIds.length > 0 && ids.length === 1) {
    return { selectedId: primaryId, includeSubcategories: false }
  }

  return { selectedId: primaryId, includeSubcategories: true }
}

export function filterCategoryOptions(
  options: CategoryFilterOption[],
  query: string
): CategoryFilterOption[] {
  const normalized = query.trim().toLocaleLowerCase("tr")
  if (!normalized) {
    return options
  }

  return options.filter((option) => option.path.toLocaleLowerCase("tr").includes(normalized))
}

