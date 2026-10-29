import { MedusaError } from "@medusajs/framework/utils"

import { transformSectionSettingsCdn } from "../../cdn/url"

import {
  EmptySettingsSchema,
  HeroShowcaseSettingsSchema,
  HtmlContentSettingsSchema,
  PromoBannerSettingsSchema,
  FastLinksSettingsSchema,
  IconBoxSettingsSchema,
  QuickCategoriesSettingsSchema,
  SelectedProductSettingsSchema,
} from "../validators"
import {
  emptyFastLinks,
  emptyHeroCard,
  emptyHtmlContent,
  emptyIconBox,
  emptyPromoBanner,
  emptySelectedProduct,
  isBannerSection,
  isProductSection,
  ProductPlacement,
  SectionSettings,
  SectionType,
} from "../types"
import { cleanTranslations, takeTranslations } from "./translations"

const PLACEMENTS = new Set<string>(["buy", "aside", "below"])

type LayoutFields = {
  placement?: ProductPlacement
  installments?: number
}

function takeLayout(settings: unknown): { content: unknown; layout: LayoutFields } {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { content: settings, layout: {} }
  }

  const source = { ...(settings as Record<string, unknown>) }
  const placement = PLACEMENTS.has(String(source.placement))
    ? (source.placement as ProductPlacement)
    : undefined
  const installments =
    typeof source.installments === "number" &&
    Number.isInteger(source.installments) &&
    source.installments >= 2 &&
    source.installments <= 36
      ? source.installments
      : undefined

  delete source.placement
  delete source.installments

  return {
    content: source,
    layout: {
      placement,
      installments: placement === "buy" ? installments : undefined,
    },
  }
}

function putLayout(data: SectionSettings, layout: LayoutFields): SectionSettings {
  if (!layout.placement) {
    return data
  }

  const next: SectionSettings = { ...data, placement: layout.placement }
  if (layout.placement === "buy" && layout.installments) {
    next.installments = layout.installments
  }

  return next
}

export function normalizeSettings(
  type: SectionType,
  settings: unknown
): SectionSettings {
  const { content: withoutTranslations, translations } = takeTranslations(settings)
  const { content, layout } = takeLayout(withoutTranslations)
  const parsed = parseSettings(type, transformSectionSettingsCdn(content, "strip"))
  const next = putLayout(parsed, layout)
  const cleaned = cleanTranslations(type, parsed, translations)

  return cleaned ? { ...next, translations: cleaned } : next
}

function parseSettings(type: SectionType, settings: unknown): SectionSettings {
  if (type === "quick-categories") {
    const parsed = QuickCategoriesSettingsSchema.safeParse(
      settings ?? { items: [] }
    )
    if (!parsed.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        parsed.error.issues[0]?.message ?? "Hızlı kategoriler geçersiz."
      )
    }

    assertUniqueIds(parsed.data.items.map((item) => item.id))
    return parsed.data
  }

  if (type === "hero-showcase") {
    const parsed = HeroShowcaseSettingsSchema.safeParse(
      settings ?? defaultSettings(type)
    )
    if (!parsed.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        parsed.error.issues[0]?.message ?? "Vitrin geçersiz."
      )
    }

    assertUniqueIds(parsed.data.slides.map((slide) => slide.id))
    return parsed.data
  }

  if (isBannerSection(type)) {
    const parsed = PromoBannerSettingsSchema.safeParse(
      settings ?? defaultSettings(type)
    )
    if (!parsed.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        parsed.error.issues[0]?.message ?? "Banner geçersiz."
      )
    }

    assertUniqueIds(parsed.data.items.map((item) => item.id))
    return parsed.data
  }

  if (type === "fast-links") {
    const parsed = FastLinksSettingsSchema.safeParse(
      settings ?? defaultSettings(type)
    )
    if (!parsed.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        parsed.error.issues[0]?.message ?? "Hızlı bağlantılar geçersiz."
      )
    }

    assertUniqueIds(parsed.data.items.map((item) => item.id))
    return parsed.data
  }

  if (type === "icon-box") {
    const parsed = IconBoxSettingsSchema.safeParse(
      settings ?? defaultSettings(type)
    )
    if (!parsed.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        parsed.error.issues[0]?.message ?? "İkon kutusu geçersiz."
      )
    }

    assertUniqueIds(parsed.data.items.map((item) => item.id))
    return parsed.data
  }

  if (type === "html-content") {
    const parsed = HtmlContentSettingsSchema.safeParse(
      settings ?? defaultSettings(type)
    )
    if (!parsed.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        parsed.error.issues[0]?.message ?? "HTML içerik geçersiz."
      )
    }

    return parsed.data
  }

  if (isProductSection(type)) {
    const parsed = SelectedProductSettingsSchema.safeParse(
      settings ?? defaultSettings(type)
    )
    if (!parsed.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        parsed.error.issues[0]?.message ?? "Ürün bölümü geçersiz."
      )
    }

    const uniqueIds = new Set(parsed.data.product_ids)
    return {
      ...parsed.data,
      product_ids: parsed.data.product_ids.filter((id) => {
        if (!uniqueIds.has(id)) {
          return false
        }
        uniqueIds.delete(id)
        return true
      }),
    }
  }

  const parsed = EmptySettingsSchema.safeParse(settings ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Bu bölümün içerik formu henüz yok."
    )
  }

  return parsed.data
}

export function defaultSettings(type: SectionType): SectionSettings {
  if (type === "quick-categories") {
    return { items: [] }
  }

  if (type === "hero-showcase") {
    return {
      slides: [],
      primary: emptyHeroCard(),
      secondary: emptyHeroCard(),
    }
  }

  if (type === "selected-product") {
    return emptySelectedProduct()
  }

  if (type === "promo-banner") {
    return emptyPromoBanner()
  }

  if (type === "fast-links") {
    return emptyFastLinks()
  }

  if (type === "icon-box") {
    return emptyIconBox()
  }

  if (type === "html-content") {
    return emptyHtmlContent()
  }

  return {}
}

function assertUniqueIds(ids: string[]) {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Öğe kimliği tekrar ediyor."
      )
    }
    seen.add(id)
  }
}
