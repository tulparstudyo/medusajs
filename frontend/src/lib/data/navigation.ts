import { sdk } from "@lib/config"

export type StoreNavItem = {
  id: string
  label: string
  align: "start" | "end"
  href: string | null
  target_type: "category" | "url" | "anchor"
  new_tab: boolean
  children: StoreNavItem[]
}

export const getNavigation = async (
  menu: "main" | "footer" | "top" | "bottom"
) => {
  try {
    return await sdk.client.fetch<{ menu: typeof menu; items: StoreNavItem[] }>(
      `/store/kibinav/${menu}`,
      { cache: "no-store" }
    )
  } catch {
    return { menu, items: [] as StoreNavItem[] }
  }
}
