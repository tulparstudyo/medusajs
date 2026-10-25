import type { StoreNavItem } from "@lib/data/navigation"

const anchor = (label: string, href: string): StoreNavItem => ({
  id: `static-${label}`,
  label,
  align: "start",
  href,
  target_type: "anchor",
  new_tab: false,
  children: [],
})

export const STATIC_NAV_ITEMS: StoreNavItem[] = [
  anchor("Elektronik", "#popular-products"),
  anchor("Moda & Giyim", "#promo-banners-mid"),
  anchor("Ev, Yaşam, Ofis", "#discount-deals"),
  anchor("Oto, Bahçe, Yapı", "#popular-products"),
  anchor("Anne, Bebek, Oyuncak", "#popular-products"),
  anchor("Spor, Outdoor", "#trending-brands"),
  anchor("Kozmetik, Bakım", "#hero-showcase"),
  anchor("Süpermarket", "#discount-deals"),
  anchor("Kitap, Müzik, Hobi", "#trending-brands"),
]
