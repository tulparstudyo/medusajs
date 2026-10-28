export const KIBI_PAGE_KEYS = ["home", "product","cookiepolicy","privacy","terms","contact","about","faq","careers"] as const

export type PageKey = (typeof KIBI_PAGE_KEYS)[number]

export const KIBI_PAGE_LABELS: Record<PageKey, string> = {
  home: "Ana Sayfa",
  product: "Ürün Detay",
  cookiepolicy: "Çerez Politikası",
  privacy: "Gizlilik Politikası",
  terms: "Kullanım Koşulları",
  contact: "İletişim",
  about: "Hakkımızda",
  faq: "S.S.S.",
  careers: "İş İlanları",

}

export const PRODUCT_PLACEMENTS = ["buy", "aside", "below"] as const

export type ProductPlacement = (typeof PRODUCT_PLACEMENTS)[number]

export const PRODUCT_PLACEMENT_LABELS: Record<ProductPlacement, string> = {
  buy: "Satın alma",
  aside: "Sağ sütun",
  below: "Açıklamanın altı",
}

const ASIDE_SECTION_TYPES = new Set<string>(["icon-box", "promo-banner", "fast-links"])

export function defaultPlacement(type: string): ProductPlacement {
  return ASIDE_SECTION_TYPES.has(type) ? "aside" : "below"
}

export function readPlacement(settings: SectionSettings, type: string): ProductPlacement {
  const value = settings.placement
  if (value === "buy" || value === "aside" || value === "below") {
    return value
  }

  return defaultPlacement(type)
}

export function readInstallments(settings: SectionSettings): number {
  const value = settings.installments
  if (typeof value !== "number" || !Number.isInteger(value) || value < 2 || value > 36) {
    return 0
  }

  return value
}

export const SECTION_TYPES = [
  "quick-categories",
  "hero-showcase",
  "selected-product",
  "promo-banner",
  "fast-links",
  "icon-box",
  "html-content",
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

export const SECTION_LABELS: Record<SectionType, string> = {
  "quick-categories": "Hızlı kategoriler",
  "hero-showcase": "Vitrin",
  "selected-product": "Seçili ürünler",
  "promo-banner": "Banner",
  "fast-links": "Hızlı bağlantılar",
  "icon-box": "İkon kutusu",
  "html-content": "HTML içerik",
}

export const PRODUCT_SOURCES = [
  "new",
  "popular",
  "advantageous",
  "discounted",
  "random",
  "editor",
  "tagged",
] as const

export type ProductSource = (typeof PRODUCT_SOURCES)[number]

export const PRODUCT_SOURCE_LABELS: Record<ProductSource, string> = {
  new: "Yeni ürünler",
  popular: "Popüler ürünler",
  advantageous: "Avantajlı ürünler",
  discounted: "İndirimli ürünler",
  random: "Random Ürünler",
  editor: "Editörün Seçimi",
  tagged: "Etiketli Ürünler",
}

export type SelectedProductSettings = {
  title: string
  source: ProductSource
  limit: number
  product_ids: string[]
  tag_id: string
}

export const emptySelectedProduct = (): SelectedProductSettings => ({
  title: "",
  source: "new",
  limit: 8,
  product_ids: [],
  tag_id: "",
})

export function isProductSection(type: string): boolean {
  return type === "selected-product"
}

export const BANNER_LAYOUTS = ["grid", "slider", "list"] as const

export type BannerLayout = (typeof BANNER_LAYOUTS)[number]

export const BANNER_LAYOUT_LABELS: Record<BannerLayout, string> = {
  grid: "Grid",
  slider: "Slider",
  list: "List",
}

export const BANNER_TONES = ["stone", "amber", "indigo", "purple", "rose"] as const

export type BannerTone = (typeof BANNER_TONES)[number]

export const BANNER_TONE_LABELS: Record<BannerTone, string> = {
  stone: "Koyu",
  amber: "Turuncu",
  indigo: "Mavi",
  purple: "Mor",
  rose: "Kırmızı",
}

export type PromoBannerItem = {
  id: string
  eyebrow: string
  title: string
  text: string
  action: string
  href: string
  tone: BannerTone
}

export type PromoBannerSettings = {
  layout: BannerLayout
  columns: number
  visible: number
  items: PromoBannerItem[]
}

export const emptyPromoBanner = (): PromoBannerSettings => ({
  layout: "grid",
  columns: 3,
  visible: 1,
  items: [],
})

export function isBannerSection(type: string): boolean {
  return type === "promo-banner"
}

export const FAST_LINK_VARIANTS = ["outline", "pill"] as const

export type FastLinkVariant = (typeof FAST_LINK_VARIANTS)[number]

export const FAST_LINK_VARIANT_LABELS: Record<FastLinkVariant, string> = {
  outline: "Çerçeveli",
  pill: "Hap",
}

export type FastLinkItem = {
  id: string
  label: string
  href: string
  icon: string
  accent: boolean
}

export type FastLinksSettings = {
  title: string
  variant: FastLinkVariant
  items: FastLinkItem[]
}

export const emptyFastLinks = (): FastLinksSettings => ({
  title: "",
  variant: "outline",
  items: [],
})

export function isFastLinksSection(type: string): boolean {
  return type === "fast-links"
}

export const ICON_BOX_TONES = [
  "orange",
  "blue",
  "emerald",
  "purple",
  "rose",
  "amber",
  "indigo",
  "slate",
] as const

export type IconBoxTone = (typeof ICON_BOX_TONES)[number]

export const ICON_BOX_TONE_LABELS: Record<IconBoxTone, string> = {
  orange: "Turuncu",
  blue: "Mavi",
  emerald: "Zümrüt",
  purple: "Mor",
  rose: "Gül",
  amber: "Kehribar",
  indigo: "İndigo",
  slate: "Arduvaz",
}

export type IconBoxItem = {
  id: string
  icon: string
  title: string
  text: string
  tone: IconBoxTone
}

export type IconBoxSettings = {
  items: IconBoxItem[]
}

export const emptyIconBox = (): IconBoxSettings => ({
  items: [],
})

export function isIconBoxSection(type: string): boolean {
  return type === "icon-box"
}

export type HtmlContentSettings = {
  html: string
}

export const emptyHtmlContent = (): HtmlContentSettings => ({
  html: "",
})

export function isHtmlContentSection(type: string): boolean {
  return type === "html-content"
}

export {
  SECTION_ICONS,
  isSectionIcon,
  sectionIconLabel,
  type SectionIcon,
} from "./icon-catalog"

export const QUICK_CATEGORY_TONES = [
  "rose",
  "blue",
  "amber",
  "emerald",
  "indigo",
  "amber-dark",
  "stone",
  "pink",
  "orange",
  "slate",
  "cyan",
  "purple",
] as const

export type QuickCategoryTone = (typeof QUICK_CATEGORY_TONES)[number]

export type QuickCategoryItem = {
  id: string
  icon: string
  title: string
  label: string
  href: string
  tone: QuickCategoryTone
}

export type QuickCategoriesSettings = {
  items: QuickCategoryItem[]
}

export type HeroSlide = {
  id: string
  image: string
  href: string
}

export type HeroCard = {
  eyebrow: string
  title: string
  text: string
  action: string
  href: string
  icon: string
}

export type HeroShowcaseSettings = {
  slides: HeroSlide[]
  primary: HeroCard
  secondary: HeroCard
}

export const emptyHeroCard = (): HeroCard => ({
  eyebrow: "",
  title: "",
  text: "",
  action: "",
  href: "",
  icon: "",
})

export type SectionSettings = Record<string, unknown>

export type TranslationSpec = {
  fields: string[]
  lists: Record<string, string[]>
  groups: Record<string, string[]>
}

const HERO_CARD_FIELDS = ["eyebrow", "title", "text", "action"]

export const SECTION_TRANSLATABLE: Record<SectionType, TranslationSpec> = {
  "quick-categories": { fields: [], lists: { items: ["title", "label"] }, groups: {} },
  "hero-showcase": {
    fields: [],
    lists: {},
    groups: { primary: HERO_CARD_FIELDS, secondary: HERO_CARD_FIELDS },
  },
  "selected-product": { fields: ["title"], lists: {}, groups: {} },
  "promo-banner": {
    fields: [],
    lists: { items: ["eyebrow", "title", "text", "action"] },
    groups: {},
  },
  "fast-links": { fields: ["title"], lists: { items: ["label"] }, groups: {} },
  "icon-box": { fields: [], lists: { items: ["title", "text"] }, groups: {} },
  "html-content": { fields: ["html"], lists: {}, groups: {} },
}

export const TRANSLATION_FIELD_LABELS: Record<string, string> = {
  eyebrow: "Üst yazı",
  title: "Başlık",
  text: "Açıklama",
  action: "Bağlantı yazısı",
  label: "Etiket",
  html: "HTML içerik",
}

export const TRANSLATION_GROUP_LABELS: Record<string, string> = {
  primary: "Birinci kart",
  secondary: "İkinci kart",
}

export type TranslationLayer = {
  fields?: Record<string, string>
  lists?: Record<string, Record<string, Record<string, string>>>
  groups?: Record<string, Record<string, string>>
}

export type SectionTranslations = Record<string, TranslationLayer>

export type ContentLocale = {
  code: string
  name: string
}

export type PageDTO = {
  id: string
  key: PageKey
  label: string
  section_count: number
}

export type SectionDTO = {
  id: string
  page_id: string
  page_key: PageKey
  type: string
  name: string
  position: number
  is_active: boolean
  settings: SectionSettings
}

export type PublicSectionDTO = {
  id: string
  type: string
  position: number
  settings: SectionSettings
}

export type CreateSectionInput = {
  page_key: PageKey
  type: SectionType
  name?: string
  is_active?: boolean
  settings?: unknown
}

export type UpdateSectionInput = {
  name: string
  is_active: boolean
  settings: unknown
}

export type ReorderSectionInput = {
  id: string
  position: number
}

export type ReorderSectionsInput = {
  page_key: PageKey
  items: ReorderSectionInput[]
}

export function isPageKey(value: string): value is PageKey {
  return (KIBI_PAGE_KEYS as readonly string[]).includes(value)
}

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value)
}
