import type { StorePageSection } from "./pages"

export type ProductPlacement = "buy" | "aside" | "below"

const ASIDE_TYPES = new Set(["icon-box", "promo-banner", "fast-links"])

export function sectionPlacement(section: StorePageSection): ProductPlacement {
  const value = section.settings.placement
  if (value === "buy" || value === "aside" || value === "below") {
    return value
  }

  return ASIDE_TYPES.has(section.type) ? "aside" : "below"
}

export function sectionInstallments(section: StorePageSection): number {
  const value = section.settings.installments
  if (typeof value !== "number" || !Number.isInteger(value) || value < 2 || value > 36) {
    return 0
  }

  return value
}

