import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import type { Translate } from "../i18n"
import { getKibiI18n } from "../i18n/server"

type Crumb = {
  id: string
  name: string
  handle: string
}

const HIDDEN_META = new Set([
  "rating",
  "review_count",
  "seller_name",
  "seller_score",
  "reviews",
  "material",
  "type",
  "weight",
  "length",
  "width",
  "height",
  "origin_country",
])

function chainOf(category: HttpTypes.StoreProductCategory): Crumb[] {
  const chain: HttpTypes.StoreProductCategory[] = []
  const seen = new Set<string>()
  let current: HttpTypes.StoreProductCategory | null | undefined = category

  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parent_category
  }

  return chain.map((item) => ({
    id: item.id,
    name: item.name,
    handle: item.handle,
  }))
}

function categoryTrail(product: HttpTypes.StoreProduct): Crumb[] {
  const categories = product.categories ?? []
  if (!categories.length) {
    return []
  }

  const ranked = categories
    .map((category) => ({ category, depth: chainOf(category).length }))
    .sort((left, right) => right.depth - left.depth)

  return chainOf(ranked[0].category)
}

function labelOf(key: string) {
  const text = key.replace(/[_-]+/g, " ").trim()
  if (!text) {
    return key
  }

  return text.charAt(0).toLocaleUpperCase("en-US") + text.slice(1)
}

function specValue(raw: unknown, t: Translate): string | null {
  if (typeof raw === "string") {
    const text = raw.trim()
    return text || null
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw)
  }

  if (typeof raw === "boolean") {
    return raw ? t("product.yes") : t("product.no")
  }

  return null
}

function specsOf(product: HttpTypes.StoreProduct, t: Translate) {
  const specs: { label: string; value: string }[] = []

  if (product.material) {
    specs.push({ label: t("product.material"), value: product.material })
  }

  if (product.type?.value) {
    specs.push({ label: t("product.type"), value: product.type.value })
  }

  if (product.weight) {
    specs.push({ label: t("product.weight"), value: `${product.weight} g` })
  }

  if (product.length || product.width || product.height) {
    const size = [product.length, product.width, product.height]
      .filter((part) => part != null)
      .join(" × ")
    specs.push({ label: t("product.dimensions"), value: size })
  }

  if (product.origin_country) {
    specs.push({ label: t("product.origin"), value: product.origin_country })
  }

  for (const [key, raw] of Object.entries(product.metadata ?? {})) {
    if (HIDDEN_META.has(key.toLocaleLowerCase("en-US"))) {
      continue
    }

    const value = specValue(raw, t)
    if (!value) {
      continue
    }

    specs.push({ label: labelOf(key), value })
  }

  return specs
}

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}

export async function ProductBreadcrumbs({ product }: { product: HttpTypes.StoreProduct }) {
  const { t } = await getKibiI18n()
  const trail = categoryTrail(product)

  return (
    <section id="product-breadcrumbs" className="bg-white border-b border-slate-200 py-2.5">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        <span className="text-slate-900 font-bold">{product.title}</span>
      </div>
    </section>
  )
}

export async function ProductDetails({ product }: { product: HttpTypes.StoreProduct }) {
  const { t } = await getKibiI18n()
  const description = product.description ? plainText(product.description) : ""
  const specs = specsOf(product, t)

  if (!description && !specs.length) {
    return null
  }

  return (
    <section id="product-details-tabs" className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <div className="px-6 py-3.5 border-b-2 border-orange-600 text-orange-600 bg-white">
            {t("product.description")}
          </div>
        </div>
        <div className="p-6 text-xs leading-relaxed text-slate-700 space-y-4">
          <h2 className="text-base font-black text-slate-900">{product.title}</h2>
          {description ? (
            <p className="whitespace-pre-line">{description}</p>
          ) : null}
          {specs.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t">
              {specs.map((spec) => (
                <div
                  key={spec.label}
                  className="p-2.5 bg-slate-50 rounded border flex justify-between gap-3"
                >
                  <span>{spec.label}</span>
                  <strong className="text-right">{spec.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
