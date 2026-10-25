export type GroupMember = {
  product_id: string
  main_code: string
  color: string
  color_hex: string | null
  position: number
}

export type AssignGroupInput = {
  main_code: string
  color: string
  color_hex?: string | null
  position?: number
}

export type AdminGroupItem = GroupMember & {
  title: string
  handle: string
  thumbnail: string | null
  status: string
}

export type AdminGroupResponse = {
  group: GroupMember | null
  items: AdminGroupItem[]
}

export type GroupCode = {
  main_code: string
  count: number
}

export type StoreGroupItem = {
  product_id: string
  handle: string
  title: string
  color: string
  color_hex: string | null
  thumbnail: string | null
  in_stock: boolean
}

export type StoreGroupResponse = {
  main_code: string | null
  items: StoreGroupItem[]
}
