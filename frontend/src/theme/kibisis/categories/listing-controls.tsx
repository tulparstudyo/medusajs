"use client"

import { usePathname, useRouter } from "next/navigation"
import { FormEvent, ReactNode, useCallback } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  COLLECTION_QUERY_KEY,
  type ListingSort,
  OPTION_VALUE_QUERY_KEY,
  SEARCH_QUERY_KEY,
  SORT_QUERY_KEY,
} from "@lib/util/listing-params"

export type ListingBrand = {
  id: string
  title: string
}

export type ListingOption = {
  id: string
  title: string
  values: { id: string; label: string }[]
}

export type ListingChild = {
  id: string
  name: string
  handle: string
}

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: "created_at", label: "Önerilen sıralama" },
  { value: "price_asc", label: "En düşük fiyat" },
  { value: "price_desc", label: "En yüksek fiyat" },
]

export type ListingQueryState = {
  q?: string
  sortBy?: ListingSort
  page?: string
  collectionIds: string[]
  optionValueIds: string[]
}

export default function ListingControls({
  title,
  count,
  description,
  childrenCategories,
  brands,
  options,
  query,
  page,
  totalPages,
  children,
}: {
  title: string
  count: number
  description?: string | null
  childrenCategories: ListingChild[]
  brands: ListingBrand[]
  options: ListingOption[]
  query: ListingQueryState
  page: number
  totalPages: number
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const commit = useCallback(
    (updater: (params: URLSearchParams) => void, resetPage = true) => {
      const params = new URLSearchParams()
      if (query.q) {
        params.set(SEARCH_QUERY_KEY, query.q)
      }
      if (query.sortBy && query.sortBy !== "created_at") {
        params.set(SORT_QUERY_KEY, query.sortBy)
      }
      query.collectionIds.forEach((id) => params.append(COLLECTION_QUERY_KEY, id))
      query.optionValueIds.forEach((id) =>
        params.append(OPTION_VALUE_QUERY_KEY, id)
      )
      if (query.page && query.page !== "1") {
        params.set("page", query.page)
      }

      const current = params.toString()
      updater(params)
      if (resetPage) {
        params.delete("page")
      }

      const nextQuery = params.toString()
      if (nextQuery === current) {
        return
      }

      const next = nextQuery ? `${pathname}?${nextQuery}` : pathname
      router.push(next, { scroll: false })
    },
    [pathname, query, router]
  )

  const toggleValue = (key: string, value: string, current: string[]) => {
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]

    commit((params) => {
      params.delete(key)
      next.forEach((item) => params.append(key, item))
    })
  }

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const query = String(form.get(SEARCH_QUERY_KEY) ?? "").trim()

    commit((params) => {
      if (query) {
        params.set(SEARCH_QUERY_KEY, query)
      } else {
        params.delete(SEARCH_QUERY_KEY)
      }
    })
  }

  const sortBy = query.sortBy || "created_at"
  const selectedBrands = query.collectionIds
  const selectedOptions = query.optionValueIds
  const hasFilters = Boolean(
    query.q ||
      query.sortBy ||
      (query.page && query.page !== "1") ||
      selectedBrands.length ||
      selectedOptions.length
  )
  const searchValue = query.q ?? ""

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <h1
            className="text-xl sm:text-2xl font-black text-slate-900"
            data-testid="category-page-title"
          >
            {title}{" "}
            <span className="text-xs text-slate-400 font-semibold">
              ({count.toLocaleString("tr-TR")} ürün)
            </span>
          </h1>
          {description ? (
            <p className="text-xs text-slate-500 max-w-2xl">{description}</p>
          ) : null}
          {childrenCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {childrenCategories.map((child) => (
                <LocalizedClientLink
                  key={child.id}
                  href={`/categories/${child.handle}`}
                  className="px-3 py-1 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-600"
                >
                  {child.name}
                </LocalizedClientLink>
              ))}
            </div>
          ) : null}
        </div>
        <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold shrink-0">
          <span>⇅ Sıralama:</span>
          <select
            className="bg-transparent text-slate-800 font-semibold focus:outline-none"
            value={SORT_OPTIONS.some((item) => item.value === sortBy) ? sortBy : "created_at"}
            onChange={(event) => {
              const value = event.target.value
              commit((params) => {
                if (value === "created_at") {
                  params.delete(SORT_QUERY_KEY)
                } else {
                  params.set(SORT_QUERY_KEY, value)
                }
              })
            }}
          >
            {SORT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {brands.length > 0 ? (
        <section className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-xs font-bold text-slate-800 shrink-0">Marka:</span>
          {brands.map((brand) => {
            const selected = selectedBrands.includes(brand.id)
            return (
              <button
                key={brand.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  toggleValue(COLLECTION_QUERY_KEY, brand.id, selectedBrands)
                }
                className={`px-3 py-1 rounded-xl border text-xs font-semibold whitespace-nowrap ${
                  selected
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                {brand.title}
                {selected ? " ×" : " +"}
              </button>
            )
          })}
        </section>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <aside className="w-full lg:w-64 bg-white rounded-2xl p-4 border border-slate-200 space-y-4 text-xs lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-bold text-sm text-slate-900">Filtreler</span>
            {hasFilters ? (
              <button
                type="button"
                className="font-semibold text-orange-600"
                onClick={() => router.push(pathname, { scroll: false })}
              >
                Temizle
              </button>
            ) : null}
          </div>

          <form onSubmit={onSearch} className="flex gap-2">
            <input
              key={searchValue}
              name={SEARCH_QUERY_KEY}
              defaultValue={searchValue}
              placeholder="Ürün ara"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-orange-600 px-3 py-2 font-bold text-white"
            >
              Ara
            </button>
          </form>

          {brands.length > 0 ? (
            <div className="space-y-1.5">
              <span className="font-bold block">Marka</span>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {brands.map((brand) => (
                  <label key={brand.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-orange-600"
                      checked={selectedBrands.includes(brand.id)}
                      onChange={() =>
                        toggleValue(COLLECTION_QUERY_KEY, brand.id, selectedBrands)
                      }
                    />
                    {brand.title}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {options.map((option) => (
            <div key={option.id} className="space-y-1.5">
              <span className="font-bold block">{option.title}</span>
              <div className="flex flex-wrap gap-1.5">
                {option.values.map((value) => {
                  const selected = selectedOptions.includes(value.id)
                  return (
                    <button
                      key={value.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        toggleValue(OPTION_VALUE_QUERY_KEY, value.id, selectedOptions)
                      }
                      className={`rounded-xl border px-2.5 py-1 font-semibold ${
                        selected
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-slate-200 text-slate-700"
                      }`}
                    >
                      {value.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>

        <section className="flex-1 w-full min-w-0 space-y-4">
          {children}
          {totalPages > 1 ? (
            <div className="flex justify-center gap-2" data-testid="product-pagination">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={item === page}
                    onClick={() =>
                      commit((params) => {
                        if (item === 1) {
                          params.delete("page")
                        } else {
                          params.set("page", String(item))
                        }
                      }, false)
                    }
                    className={`min-w-8 rounded-lg border px-2 py-1 text-xs font-bold ${
                      item === page
                        ? "border-orange-600 bg-orange-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
