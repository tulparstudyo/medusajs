import { CategoryOption } from "../types"

export type CategoryNode = {
  id: string
  name: string
  parentId: string | null
  rank: number
}

export function categoryPaths(rows: CategoryNode[]): CategoryOption[] {
  const ids = new Set(rows.map((row) => row.id))
  const children = new Map<string | null, CategoryNode[]>()

  for (const row of rows) {
    const parentId = row.parentId && ids.has(row.parentId) ? row.parentId : null
    const siblings = children.get(parentId) ?? []
    siblings.push(row)
    children.set(parentId, siblings)
  }

  for (const siblings of children.values()) {
    siblings.sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank
      }

      return left.name.localeCompare(right.name, "tr")
    })
  }

  const options: CategoryOption[] = []
  const seen = new Set<string>()

  const visit = (row: CategoryNode, prefix: string[]) => {
    if (seen.has(row.id)) {
      return
    }

    seen.add(row.id)
    const path = [...prefix, row.name]
    options.push({ id: row.id, name: path.join(" / ") })

    for (const child of children.get(row.id) ?? []) {
      visit(child, path)
    }
  }

  for (const row of children.get(null) ?? []) {
    visit(row, [])
  }

  const cycles = rows
    .filter((row) => !seen.has(row.id))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank
      }

      return left.name.localeCompare(right.name, "tr")
    })

  for (const row of cycles) {
    visit(row, [])
  }

  return options
}
