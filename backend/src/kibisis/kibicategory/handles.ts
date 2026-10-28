import { slugify } from "../kibiimport/lib/slug"

export type CategoryNode = {
  id: string
  name: string
  handle: string
  parentId: string | null
}

export type HandleChange = {
  id: string
  name: string
  path: string[]
  from: string
  to: string
}

/** Segment turns one name into "a-z0-9-" text: "Yağmurluk & Rüzgarlık" → "yagmurluk-ruzgarlik". */
export function segment(name: string): string {
  const result = slugify(name)
  return result === "urun" && !/^(ürün|urun)$/i.test(name.trim()) ? "kategori" : result
}

/** TreeHandle joins the segments of a name path: ["Kadın", "Giyim"] → "kadin/giyim". */
export function treeHandle(names: string[]): string {
  return names.map(segment).join("/")
}

/** CleanHandle sanitizes a given handle segment by segment and keeps its slashes. */
export function cleanHandle(handle: string): string {
  return handle
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(segment)
    .join("/")
}

/** FreeHandle returns the handle, or the first "-2", "-3"… variant nobody holds. */
export function freeHandle(base: string, taken: Set<string>): string {
  if (!taken.has(base.toLowerCase())) {
    return base
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`

    if (!taken.has(candidate.toLowerCase())) {
      return candidate
    }
  }
}

/** NamePath lists the names from the top category down to the given one. */
export function namePath(id: string, byId: Map<string, CategoryNode>): string[] {
  const names: string[] = []
  const seen = new Set<string>()

  for (let current: string | null = id; current && !seen.has(current); ) {
    seen.add(current)
    const node = byId.get(current)

    if (!node) {
      break
    }

    names.unshift(node.name)
    current = node.parentId
  }

  return names
}

/**
 * PlanHandleRebuild gives every category in scope the handle of its place in
 * the tree. The scope is the chosen category with everything below it, or
 * the whole catalogue. Handles outside the scope are left alone and count
 * as taken.
 */
export function planHandleRebuild(categories: CategoryNode[], rootId: string | null): HandleChange[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const children = new Map<string | null, CategoryNode[]>()

  for (const category of categories) {
    const parentId = category.parentId && byId.has(category.parentId) ? category.parentId : null
    children.set(parentId, [...(children.get(parentId) ?? []), category])
  }

  const scope: CategoryNode[] = []
  const collect = (node: CategoryNode) => {
    scope.push(node)
    for (const child of children.get(node.id) ?? []) {
      collect(child)
    }
  }

  if (rootId) {
    const root = byId.get(rootId)

    if (root) {
      collect(root)
    }
  } else {
    for (const node of children.get(null) ?? []) {
      collect(node)
    }
  }

  const inScope = new Set(scope.map((node) => node.id))
  const taken = new Set(
    categories.filter((category) => !inScope.has(category.id)).map((category) => category.handle.toLowerCase())
  )
  const changes: HandleChange[] = []

  for (const node of scope) {
    const path = namePath(node.id, byId)
    const base = treeHandle(path)
    const to = node.handle.toLowerCase() === base.toLowerCase() && !taken.has(base.toLowerCase())
      ? node.handle
      : freeHandle(base, taken)

    taken.add(to.toLowerCase())

    if (to !== node.handle) {
      changes.push({ id: node.id, name: node.name, path, from: node.handle, to })
    }
  }

  return changes
}
