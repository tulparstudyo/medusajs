import { Badge, Button, Container, Heading, Input, Label, Switch, Text, clx } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

import {
  buildCategoryFilterOptions,
   categoryFilterQueryIds,
  CategoryFilterOption,
  CategoryFilterRow,
  filterCategoryOptions,
  parseCategoryFilterParam,
} from "../filter"

const PAGE_LIMIT = 200
const MAX_CATEGORIES = 2000

async function fetchAllCategoryRows(): Promise<CategoryFilterRow[]> {
  const collected: CategoryFilterRow[] = []
  let offset = 0

  while (offset < MAX_CATEGORIES) {
    const response = await fetch(
      `/admin/product-categories?limit=${PAGE_LIMIT}&offset=${offset}&fields=id,name,parent_category_id,rank`,
      {
        credentials: "include",
        headers: {
          accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      throw new Error("Kategoriler yüklenemedi.")
    }

    const body = (await response.json()) as {
      product_categories?: CategoryFilterRow[]
      count?: number
    }
    const items = body.product_categories ?? []
    collected.push(...items)
    offset += PAGE_LIMIT

    const total = typeof body.count === "number" ? body.count : items.length
    if (!items.length || collected.length >= total) {
      break
    }
  }

  return collected
}

export default function ProductsCategoryFilterWidget() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [options, setOptions] = useState<CategoryFilterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchAllCategoryRows()
      .then((rows) => {
        if (!cancelled) {
          setOptions(buildCategoryFilterOptions(rows))
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Kategoriler yüklenemedi.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [open])

  const categoryParam = searchParams.get("category_id")

  const { selectedId, includeSubcategories } = useMemo(
    () => parseCategoryFilterParam(options, categoryParam),
    [options, categoryParam]
  )

  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedId) ?? null,
    [options, selectedId]
  )

  const filteredOptions = useMemo(
    () => filterCategoryOptions(options, query),
    [options, query]
  )

  const applyFilter = (nextSelectedId: string, nextIncludeSubcategories: boolean) => {
    const ids = categoryFilterQueryIds(options, nextSelectedId, nextIncludeSubcategories)
    const nextParams = new URLSearchParams(searchParams)

    if (ids.length > 0) {
      nextParams.set("category_id", ids.join(","))
    } else {
      nextParams.delete("category_id")
    }

    nextParams.delete("offset")
    setSearchParams(nextParams)
  }

  const handleSelectCategory = (nextSelectedId: string) => {
    applyFilter(nextSelectedId, includeSubcategories)
    setOpen(false)
    setQuery("")
  }

  const handleToggleOnlyThisCategory = (onlyThisCategory: boolean) => {
    const nextIncludeSubcategories = !onlyThisCategory
    if (selectedId) {
      applyFilter(selectedId, nextIncludeSubcategories)
    }
  }

  const handleClear = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("category_id")
    nextParams.delete("offset")
    setSearchParams(nextParams)
    setQuery("")
    setOpen(false)
  }

  const onlyThisCategory = !includeSubcategories

  return (
    <Container className="flex flex-col gap-3 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level="h2">Kategori Filtresi</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Ürün listesini kategoriye ve alt kategorilerine göre filtreleyin.
          </Text>
        </div>

        {selectedOption && (
          <div className="flex items-center gap-2">
            <Badge size="small" color="blue">
              {selectedOption.path}
              {includeSubcategories && selectedOption.descendantIds.length > 0
                ? ` (+${selectedOption.descendantIds.length} alt kategori)`
                : ""}
            </Badge>
            <Button size="small" variant="secondary" type="button" onClick={handleClear}>
              Filtreyi Temizle
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div ref={dropdownRef} className="relative min-w-[280px] max-w-[480px] flex-1">
          <button
            type="button"
            disabled={loading}
            onClick={() => setOpen((prev) => !prev)}
            className={clx(
              "bg-ui-bg-field hover:bg-ui-bg-field-hover border-ui-border-base text-ui-fg-base shadow-buttons-neutral",
              "flex h-8 w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-xs transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <span className={clx("truncate", !selectedOption && "text-ui-fg-muted")}>
              {loading
                ? "Kategoriler yükleniyor..."
                : selectedOption
                  ? selectedOption.path
                  : "Tüm Kategoriler (Kategori seçin...)"}
            </span>
            <span className="text-ui-fg-muted shrink-0 text-[10px]">▼</span>
          </button>

          {open && (
            <div className="border-ui-border-base bg-ui-bg-component shadow-elevation-flyout absolute left-0 top-full z-50 mt-1 w-full min-w-[320px] rounded-lg border p-2">
              <Input
                size="small"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false)
                  } else if (event.key === "Enter" && filteredOptions.length > 0) {
                    event.preventDefault()
                    handleSelectCategory(filteredOptions[0].id)
                  }
                }}
                placeholder="Kategori yolu ara (örn. Giyim > Kadın > Elbise)..."
              />

              <div className="mt-2 max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => handleSelectCategory("")}
                  className={clx(
                    "hover:bg-ui-bg-base-hover text-ui-fg-base flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                    !selectedId && "bg-ui-bg-base-pressed font-medium"
                  )}
                >
                  <span>Tüm Kategoriler</span>
                </button>

                {filteredOptions.length === 0 ? (
                  <div className="text-ui-fg-subtle px-2.5 py-3 text-center text-xs">
                    Aramaya uygun kategori bulunamadı.
                  </div>
                ) : (
                  filteredOptions.map((option) => {
                    const isSelected = option.id === selectedId
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelectCategory(option.id)}
                        className={clx(
                          "hover:bg-ui-bg-base-hover text-ui-fg-base flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                          isSelected && "bg-ui-bg-base-pressed font-medium"
                        )}
                      >
                        <span className="truncate">{option.path}</span>
                        {option.descendantIds.length > 0 && (
                          <span className="text-ui-fg-muted shrink-0 text-[11px]">
                            +{option.descendantIds.length} alt
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {selectedOption && selectedOption.descendantIds.length > 0 && (
          <div className="flex items-center gap-2">
            <Switch
              id="kibicategory-only-selected"
              size="small"
              checked={onlyThisCategory}
              onCheckedChange={handleToggleOnlyThisCategory}
            />
            <Label
              htmlFor="kibicategory-only-selected"
              size="small"
              className="cursor-pointer select-none"
            >
              Sadece bu kategori (alt kategorileri hariç tut)
            </Label>
          </div>
        )}
      </div>

      {error && (
        <Text size="small" className="text-ui-fg-error">
          {error}
        </Text>
      )}
    </Container>
  )
}

