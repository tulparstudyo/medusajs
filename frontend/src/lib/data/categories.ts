import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

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
    ...(await getCacheOptions("categories")),
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
    ...(await getCacheOptions("categories")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields:
            "*category_children, *category_children.category_children, *category_children.category_children.category_children, *parent_category, *parent_category.parent_category, *products",
          handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
