import { renderFastLinks } from "../sections/fast-links/render"
import FastLinksView from "../sections/fast-links/view"
import { renderIconBox } from "../sections/icon-box/render"
import IconBoxView from "../sections/icon-box/view"
import { renderHeroShowcase } from "../sections/hero-showcase/render"
import HeroShowcaseView from "../sections/hero-showcase/view"
import { renderQuickCategories } from "../sections/quick-categories/render"
import QuickCategoriesView from "../sections/quick-categories/view"
import { renderPromoBanner } from "../sections/promo-banner/render"
import PromoBannerView from "../sections/promo-banner/view"
import SelectedProductSection from "../sections/selected-product"
import type { StorePageSection } from "@lib/data/pages"

export default function SectionSlot({
  section,
  countryCode,
}: {
  section: StorePageSection
  countryCode: string
}) {
  switch (section.type) {
    case "quick-categories": {
      const html = renderQuickCategories(section.id, section.settings)
      if (!html) {
        return null
      }

      return <QuickCategoriesView html={html} />
    }
    case "hero-showcase": {
      const html = renderHeroShowcase(section.id, section.settings)
      if (!html) {
        return null
      }

      return <HeroShowcaseView html={html} />
    }
    case "selected-product":
      return (
        <SelectedProductSection section={section} countryCode={countryCode} />
      )
    case "promo-banner": {
      const html = renderPromoBanner(section.id, section.settings)
      if (!html) {
        return null
      }

      return <PromoBannerView html={html} />
    }
    case "fast-links": {
      const html = renderFastLinks(section.id, section.settings)
      if (!html) {
        return null
      }

      return <FastLinksView html={html} />
    }
    case "icon-box": {
      const html = renderIconBox(section.id, section.settings)
      if (!html) {
        return null
      }

      return <IconBoxView html={html} />
    }
    default:
      return null
  }
}
