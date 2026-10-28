import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCatalogCacheOptions } from "./cookies"

export function categoryTreeIds(
  category: HttpTypes.StoreProductCategory
): string[] {
  const ids = [category.id]
  for (const child of category.category_children ?? []) {
    ids.push(...categoryTreeIds(child))
  }

  return Array.from(new Set(ids.filter(Boolean)))
}

export const listCategories = async (query?: Record<string, unknown>) => {
  const next = {
    ...(await getCatalogCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = categoryHandle
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join("/")

  const next = {
    ...(await getCatalogCacheOptions("categories")),
  }

  const fetchCategory = (query: Record<string, unknown>) =>
    sdk.client
      .fetch<HttpTypes.StoreProductCategoryListResponse>(
        `/store/product-categories`,
        { query: { handle, ...query }, next, cache: "force-cache" }
      )
      .then(({ product_categories }) => product_categories[0])

  // Nested `category_children.*` field paths come back empty, and combining
  // `include_descendants_tree` with `include_ancestors_tree` drops the tree on
  // root categories, so the parents and the subtree are fetched separately.
  const [category, tree] = await Promise.all([
    fetchCategory({
      fields:
        "*category_children, *parent_category, *parent_category.parent_category, *products",
    }),
    fetchCategory({
      fields: "id, *category_children",
      include_descendants_tree: true,
    }),
  ])

  if (!category) {
    return category
  }

  return {
    ...category,
    category_children: tree?.category_children ?? category.category_children,
  }
}
