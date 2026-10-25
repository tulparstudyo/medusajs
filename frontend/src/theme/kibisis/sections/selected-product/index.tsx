import type { StorePageSection } from "@lib/data/pages"
import ProductRail from "../../home/product-rail"
import { loadSelectedProducts } from "./load"

export default async function SelectedProductSection({
  section,
  countryCode,
}: {
  section: StorePageSection
  countryCode: string
}) {
  const loaded = await loadSelectedProducts(countryCode, section)
  if (!loaded) {
    return null
  }

  return (
    <ProductRail
      sectionId={section.id}
      title={loaded.title}
      products={loaded.products}
      controls="scroll"
    />
  )
}
