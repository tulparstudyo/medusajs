export const NAV_MENUS = ["main", "footer", "top", "bottom"] as const

export type NavMenu = (typeof NAV_MENUS)[number]

export const NAV_ALIGNS = ["start", "end"] as const

export type NavAlign = (typeof NAV_ALIGNS)[number]

export const TARGET_TYPES = ["category", "url", "anchor"] as const

export type TargetType = (typeof TARGET_TYPES)[number]

export type NavItemDTO = {
  id: string
  menu: NavMenu
  align: NavAlign
  label: string
  parent_id: string | null
  position: number
  target_type: TargetType
  category_id: string | null
  url: string | null
  anchor: string | null
  new_tab: boolean
  is_active: boolean
}

export type CreateNavItemInput = {
  menu: NavMenu
  label: string
  align?: NavAlign
  parent_id?: string | null
  is_active?: boolean
  new_tab?: boolean
  target_type: TargetType
  category_id?: string
  url?: string
  anchor?: string
}

export type UpdateNavItemInput = {
  label: string
  align?: NavAlign
  is_active?: boolean
  new_tab?: boolean
  target_type: TargetType
  category_id?: string
  url?: string
  anchor?: string
}

export type ReorderNavItemInput = {
  id: string
  parent_id: string | null
  position: number
}

export type ReorderNavInput = {
  menu: NavMenu
  items: ReorderNavItemInput[]
}

export type NormalizedTarget = {
  target_type: TargetType
  category_id: string | null
  url: string | null
  anchor: string | null
  new_tab: boolean
}

export type PublicNavItem = {
  id: string
  label: string
  align: NavAlign
  href: string | null
  target_type: TargetType
  new_tab: boolean
  children: PublicNavItem[]
}
