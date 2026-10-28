import { cleanHandle, freeHandle, namePath, treeHandle } from "./handles"
import { CategoryTree, normalizeName } from "./schema"

export type ExistingCategory = {
  id: string
  name: string
  handle: string
  parentId: string | null
}

export type PlanEntry = {
  key: string
  path: string[]
  depth: number
  name: string
  handle: string
  description?: string
  isActive: boolean
  isInternal: boolean
  /** Set when the parent already exists. */
  parentId: string | null
  /** Set when the parent is created by this plan. */
  parentKey: string | null
  /** The existing category, or the created one after the import. */
  id: string | null
  action: "create" | "exists"
}

export type PlanDefaults = {
  isActive: boolean
  isInternal: boolean
}

/**
 * PlanCategories walks the tree from the chosen parent and matches each node
 * to an existing child of the same name. Only unmatched nodes are created,
 * so importing the same file again changes nothing. A new category's handle
 * is its path from the top category, e.g. "kadin/giyim/elbise". Entries
 * come parents first, in file order.
 */
export function planCategories(
  tree: CategoryTree[],
  existing: ExistingCategory[],
  rootId: string | null,
  defaults: PlanDefaults
): PlanEntry[] {
  const taken = new Set(existing.map((category) => category.handle.toLowerCase()))
  const byId = new Map(existing.map((category) => [category.id, category]))
  const children = new Map<string | null, ExistingCategory[]>()

  for (const category of existing) {
    children.set(category.parentId, [...(children.get(category.parentId) ?? []), category])
  }

  const rootNames = rootId ? namePath(rootId, byId) : []
  const entries: PlanEntry[] = []

  const visit = (nodes: CategoryTree[], parent: { id: string | null; key: string | null; path: string[] }) => {
    for (const node of nodes) {
      const path = [...parent.path, node.name]
      const key = path.map(normalizeName).join("\u0000")
      const match =
        parent.key === null
          ? (children.get(parent.id) ?? []).find(
              (category) => normalizeName(category.name) === normalizeName(node.name)
            )
          : undefined
      const handle = match
        ? match.handle
        : freeHandle(node.handle ? cleanHandle(node.handle) : treeHandle([...rootNames, ...path]), taken)

      if (!match) {
        taken.add(handle.toLowerCase())
      }

      entries.push({
        key,
        path,
        depth: path.length,
        name: node.name,
        handle,
        description: node.description,
        isActive: node.isActive ?? defaults.isActive,
        isInternal: node.isInternal ?? defaults.isInternal,
        parentId: parent.key === null ? parent.id : null,
        parentKey: parent.key,
        id: match?.id ?? null,
        action: match ? "exists" : "create",
      })

      visit(node.children, { id: match?.id ?? null, key: match ? null : key, path })
    }
  }

  visit(tree, { id: rootId, key: null, path: [] })

  return entries
}
