import { sdk } from "@lib/config"
import { categoryTreeIds } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { listProductsWithSort } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { OptionValueIds } from "@lib/util/product-option-filters"

import ProductCard from "../home/product-card"
import ListingControls, {
  ListingBrand,
  ListingChild,
  ListingOption,
} from "./listing-controls"
import { toListingCard } from "./map-product"

const PRODUCT_LIMIT = 12

type FilterOptionResponse = {
  product_options?: HttpTypes.StoreProductOption[]
}

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

async function loadOptions(): Promise<ListingOption[]> {
  try {
    const response = await sdk.client.fetch<FilterOptionResponse>(
      "/store/product-options",
      {
        method: "GET",
        query: {
          is_exclusive: false,
          fields: "*values",
          limit: 50,
        },
        cache: "force-cache",
      }
    )

    return (response.product_options ?? []).flatMap((option) => {
      const values = (option.values ?? [])
        .map((value) => ({
          id: value.id,
          label: value.value,
        }))
        .filter(
          (value): value is { id: string; label: string } =>
            Boolean(value.id && value.label)
        )

      if (!option.id || !values.length) {
        return []
      }

      return [
        {
          id: option.id,
          title: option.title || "Seçenek",
          values,
        },
      ]
    })
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
  const pageNumber = pageNumberOf(page)
  const sort = sortBy || "created_at"
  const trail = ancestors(category)
  const children: ListingChild[] = (category.category_children ?? [])
    .filter((child) => child.id && child.name && child.handle)
    .map((child) => ({
      id: child.id,
      name: child.name,
      handle: child.handle,
    }))

  const [listed, brands, options] = await Promise.all([
    listProductsWithSort({
      page: pageNumber,
      queryParams: {
        limit: PRODUCT_LIMIT,
        category_id: categoryTreeIds(category),
        ...(collectionIds.length ? { collection_id: collectionIds } : {}),
        ...(q ? { q } : {}),
      },
      sortBy: sort,
      countryCode,
      optionValueIds,
    }),
    loadBrands(),
    loadOptions(),
  ])

  const cards = listed.response.products.flatMap((product) => {
    const card = toListingCard(product)
    return card ? [card] : []
  })
  const totalPages = Math.ceil(listed.response.count / PRODUCT_LIMIT)

  return (
    <main
      className="max-w-7xl mx-auto px-4 py-4 space-y-4"
      data-testid="category-container"
    >
      <section className="py-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <LocalizedClientLink href="/" className="hover:text-orange-600">
            Ana Sayfa
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
        count={listed.response.count}
        description={category.description}
        childrenCategories={children}
        brands={brands}
        options={options}
        page={pageNumber}
        totalPages={totalPages}
        query={{
          q,
          sortBy: sortBy,
          page,
          collectionIds,
          optionValueIds: optionValueIds ?? [],
        }}
      >
        {cards.length ? (
          <ul
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"
            data-testid="products-list"
          >
            {cards.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} layout="grid" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            Bu filtrelere uygun ürün bulunamadı.
          </div>
        )}
      </ListingControls>
    </main>
  )
}
