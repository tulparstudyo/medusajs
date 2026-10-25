export type TreeSource = {
  id: string
  parent_id: string | null
  position: number
}

export type TreeNode<T extends TreeSource> = T & {
  children: TreeNode<T>[]
}

export type ReorderPayload = {
  id: string
  parent_id: string | null
  position: number
}

const compareNodes = (a: TreeSource, b: TreeSource) =>
  a.position - b.position || a.id.localeCompare(b.id)

export function buildTree<T extends TreeSource>(
  items: T[],
  options?: { promoteOrphans?: boolean }
): TreeNode<T>[] {
  const ids = new Set(items.map((item) => item.id))
  const groups = new Map<string | null, T[]>()

  for (const item of items) {
    const parentExists = !!item.parent_id && ids.has(item.parent_id)
    const keepMissingParent = !options?.promoteOrphans
    const parentId = parentExists || keepMissingParent ? item.parent_id : null
    const list = groups.get(parentId) ?? []
    list.push(item)
    groups.set(parentId, list)
  }

  for (const list of groups.values()) {
    list.sort(compareNodes)
  }

  const walk = (parentId: string | null): TreeNode<T>[] =>
    (groups.get(parentId) ?? []).map((item) => ({
      ...item,
      children: walk(item.id),
    }))

  return walk(null)
}

export function findNode<T extends TreeSource>(
  nodes: TreeNode<T>[],
  id: string
): TreeNode<T> | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }

    const child = findNode(node.children, id)
    if (child) {
      return child
    }
  }

  return null
}

export function containsId<T extends TreeSource>(
  nodes: TreeNode<T>[],
  id: string
): boolean {
  return nodes.some((node) => node.id === id || containsId(node.children, id))
}

export function removeNode<T extends TreeSource>(
  nodes: TreeNode<T>[],
  id: string
): { tree: TreeNode<T>[]; removed: TreeNode<T> | null } {
  let removed: TreeNode<T> | null = null

  const tree = nodes.flatMap((node) => {
    if (node.id === id) {
      removed = node
      return []
    }

    const next = removeNode(node.children, id)
    if (next.removed) {
      removed = next.removed
    }

    return [{ ...node, children: next.tree }]
  })

  return { tree, removed }
}

export function insertNode<T extends TreeSource>(
  nodes: TreeNode<T>[],
  parentId: string | null,
  index: number,
  node: TreeNode<T>
): TreeNode<T>[] {
  if (parentId === null) {
    const copy = nodes.slice()
    copy.splice(clamp(index, 0, copy.length), 0, node)
    return copy
  }

  return nodes.map((item) => {
    if (item.id !== parentId) {
      return {
        ...item,
        children: insertNode(item.children, parentId, index, node),
      }
    }

    const children = item.children.slice()
    children.splice(clamp(index, 0, children.length), 0, node)
    return { ...item, children }
  })
}

export function toReorderPayload<T extends TreeSource>(
  nodes: TreeNode<T>[],
  parentId: string | null = null,
  out: ReorderPayload[] = []
): ReorderPayload[] {
  nodes.forEach((node, position) => {
    out.push({ id: node.id, parent_id: parentId, position })
    toReorderPayload(node.children, node.id, out)
  })

  return out
}

export function moveFlatItem<T extends TreeSource>(
  items: T[],
  activeId: string,
  parentId: string | null,
  index: number
): T[] | null {
  const tree = buildTree(items, { promoteOrphans: true })
  const activeNode = findNode(tree, activeId)

  if (!activeNode || parentId === activeId) {
    return null
  }

  if (parentId && containsId(activeNode.children, parentId)) {
    return null
  }

  const { tree: without, removed } = removeNode(tree, activeId)
  if (!removed || (parentId && !findNode(without, parentId))) {
    return null
  }

  const next = insertNode(without, parentId, index, removed)
  const payload = new Map(
    toReorderPayload(next).map((entry) => [entry.id, entry])
  )

  return items.map((item) => {
    const update = payload.get(item.id)
    if (!update) {
      return item
    }

    return {
      ...item,
      parent_id: update.parent_id,
      position: update.position,
    }
  })
}

export function hasCycle(
  parentById: Map<string, string | null>
): boolean {
  const state = new Map<string, "visiting" | "done">()

  const visit = (id: string): boolean => {
    const mark = state.get(id)
    if (mark === "visiting") {
      return true
    }
    if (mark === "done") {
      return false
    }

    state.set(id, "visiting")
    const parent = parentById.get(id)
    if (parent && parentById.has(parent) && visit(parent)) {
      return true
    }

    state.set(id, "done")
    return false
  }

  for (const id of parentById.keys()) {
    if (visit(id)) {
      return true
    }
  }

  return false
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)
