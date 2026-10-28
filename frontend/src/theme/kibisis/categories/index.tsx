import { categoryTreeIds } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { OptionValueIds } from "@lib/util/product-option-filters"

import InfiniteProductGrid from "./infinite-grid"
import ListingControls, { ListingBrand, ListingChild } from "./listing-controls"
import { getKibiI18n } from "../i18n/server"
import { loadListingPage, type ListingRequest } from "./load-page"

function ancestors(category: HttpTypes.StoreProductCategory) {
  const chain: HttpTypes.StoreProductCategory[] = []
  const seen = new Set<string>()
  let current = category.parent_category

  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parent_category
  }

  return chain
}

function pageNumberOf(page?: string) {
  const parsed = Number.parseInt(page || "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

async function loadStockedChildren(
  category: HttpTypes.StoreProductCategory,
  countryCode: string
): Promise<ListingChild[]> {
  const children = (category.category_children ?? []).filter(
    (child) => child.id && child.name && child.handle
  )

  const counted = await Promise.all(
    children.map(async (child) => {
      try {
        const { response } = await listProducts({
          countryCode,
          queryParams: {
            limit: 1,
            fields: "id",
            category_id: categoryTreeIds(child),
          },
        })
        return response.count > 0 ? child : null
      } catch {
        return null
      }
    })
  )

  return counted.flatMap((child) =>
    child ? [{ id: child.id, name: child.name, handle: child.handle }] : []
  )
}

async function loadBrands(): Promise<ListingBrand[]> {
  try {
    const { collections } = await listCollections()
    return collections
      .filter((collection) => collection.id && collection.title)
      .map((collection) => ({
        id: collection.id,
        title: collection.title,
      }))
  } catch {
    return []
  }
}

export default async function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  optionValueIds,
  q,
  collectionIds = [],
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
  q?: string
  collectionIds?: string[]
}) {
  const { t } = await getKibiI18n()
  const pageNumber = pageNumberOf(page)
  const trail = ancestors(category)

  const request: ListingRequest = {
    countryCode,
    categoryIds: [category.id],
    collectionIds,
    optionValueIds: optionValueIds ?? [],
    ...(q ? { q } : {}),
    ...(sortBy ? { sortBy } : {}),
  }

  const [listed, brands, children] = await Promise.all([
    loadListingPage(request, pageNumber),
    loadBrands(),
    loadStockedChildren(category, countryCode),
  ])

  return (
    <main
      className="max-w-7xl mx-auto px-4 py-4 space-y-4"
      data-testid="category-container"
    >
      <section className="py-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <LocalizedClientLink href="/" className="hover:text-orange-600">
            {t("common.home")}
          </LocalizedClientLink>
          {trail.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <span>›</span>
              <LocalizedClientLink
                href={`/categories/${crumb.handle}`}
                className="hover:text-orange-600"
              >
                {crumb.name}
              </LocalizedClientLink>
            </span>
          ))}
          <span>›</span>
          <span className="text-slate-900 font-bold">{category.name}</span>
        </div>
      </section>

      <ListingControls
        title={category.name}
        count={listed.count}
        description={category.description}
        childrenCategories={children}
        brands={brands}
        options={listed.options}
        query={{
          q,
          sortBy: sortBy,
          page,
          collectionIds,
          optionValueIds: optionValueIds ?? [],
        }}
      >
        <InfiniteProductGrid
          key={JSON.stringify(request)}
          request={request}
          initialPage={pageNumber}
          initialCards={listed.cards}
          totalPages={listed.totalPages}
        />
      </ListingControls>
    </main>
  )
}
