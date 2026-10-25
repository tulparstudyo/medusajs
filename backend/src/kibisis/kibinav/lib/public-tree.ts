import { NavItemDTO, PublicNavItem } from "../types"
import { buildTree, TreeNode } from "./tree"

export function toPublicTree(
  items: NavItemDTO[],
  handles: Map<string, string>
): PublicNavItem[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const visible = items.filter((item) => hasActiveAncestors(item, byId))

  return buildTree(visible).map((node) => toPublicNode(node, handles))
}

function hasActiveAncestors(
  item: NavItemDTO,
  byId: Map<string, NavItemDTO>
): boolean {
  if (!item.is_active) {
    return false
  }

  const seen = new Set<string>()
  let parentId = item.parent_id

  while (parentId) {
    if (seen.has(parentId)) {
      return false
    }

    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent?.is_active) {
      return false
    }

    parentId = parent.parent_id
  }

  return true
}

function toPublicNode(
  node: TreeNode<NavItemDTO>,
  handles: Map<string, string>
): PublicNavItem {
  return {
    id: node.id,
    label: node.label,
    align: node.align === "end" ? "end" : "start",
    href: resolveHref(node, handles),
    target_type: node.target_type,
    new_tab: node.target_type === "url" && node.new_tab,
    children: node.children.map((child) => toPublicNode(child, handles)),
  }
}

function resolveHref(
  item: NavItemDTO,
  handles: Map<string, string>
): string | null {
  if (item.target_type === "category") {
    const handle = item.category_id ? handles.get(item.category_id) : undefined
    return handle ? `/categories/${handle}` : null
  }

  if (item.target_type === "url") {
    return item.url
  }

  return item.anchor
}
