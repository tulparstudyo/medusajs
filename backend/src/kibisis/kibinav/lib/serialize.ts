import { NavItemDTO, NavMenu, TargetType } from "../types"

type NavItemRecord = {
  id: string
  menu: string
  align?: string | null
  label: string
  parent_id: string | null
  position: number
  target_type: string
  category_id: string | null
  url: string | null
  anchor: string | null
  new_tab: boolean
  is_active: boolean
}

export function serializeNavItem(item: NavItemRecord): NavItemDTO {
  return {
    id: item.id,
    menu: item.menu as NavMenu,
    align: item.align === "end" ? "end" : "start",
    label: item.label,
    parent_id: item.parent_id,
    position: item.position,
    target_type: item.target_type as TargetType,
    category_id: item.category_id,
    url: item.url,
    anchor: item.anchor,
    new_tab: item.new_tab,
    is_active: item.is_active,
  }
}
