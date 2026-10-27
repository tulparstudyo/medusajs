import type { TranslationJob } from "./ai-translate-modal"
import { createEntityTranslationJob, EntityTarget, loadEntityGroups } from "./entity-translation"
import { EntityGroup } from "./entity-translation-job"

/** The ids of a product and the translatable records it owns. */
export type ProductIds = {
  id: string
  variants?: { id: string }[] | null
  options?: { id: string; values?: { id: string }[] | null }[] | null
}

export const PRODUCT_ID_FIELDS = "id,variants.id,options.id,options.values.id"

export const PRODUCT_TRANSLATION_CONTEXT =
  "e-commerce product texts: product title, subtitle, description and material, variant titles, option names and option values"

/** Products with their variants, options and option values. */
export function productTargets(products: ProductIds[]): EntityTarget[] {
  const options = products.flatMap((product) => product.options ?? [])

  return [
    ["product", products.map((product) => product.id)],
    ["product_variant", products.flatMap((product) => (product.variants ?? []).map((variant) => variant.id))],
    ["product_option", options.map((option) => option.id)],
    ["product_option_value", options.flatMap((option) => (option.values ?? []).map((value) => value.id))],
  ]
}

export function loadProductGroups(products: ProductIds[]): Promise<EntityGroup[]> {
  return loadEntityGroups(productTargets(products))
}

export function createProductTranslationJob(groups: { current: EntityGroup[] }): TranslationJob {
  return createEntityTranslationJob(groups, PRODUCT_TRANSLATION_CONTEXT)
}
