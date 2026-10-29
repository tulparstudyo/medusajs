import { Button, Input, Label, Select, Text } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"

import { api } from "../api"
import {
  emptySelectedProduct,
  PRODUCT_SOURCE_LABELS,
  PRODUCT_SOURCES,
  ProductSource,
  SectionSettings,
  SelectedProductSettings,
} from "../../types"

type ProductOption = {
  id: string
  title?: string | null
  thumbnail?: string | null
}

type TagOption = {
  id: string
  value?: string | null
}

const sources = new Set<string>(PRODUCT_SOURCES)

function clampDimension(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0
  }
  const truncated = Math.trunc(value)
  if (truncated <= 0) {
    return 0
  }
  return Math.min(4096, truncated)
}

export function readSelectedProduct(
  settings: SectionSettings | null | undefined
): SelectedProductSettings {
  const sourceValue = settings?.source
  const source =
    typeof sourceValue === "string" && sources.has(sourceValue)
      ? (sourceValue as ProductSource)
      : "new"
  const title = typeof settings?.title === "string" ? settings.title : ""
  const limit = typeof settings?.limit === "number" ? settings.limit : 8
  const productIds = Array.isArray(settings?.product_ids)
    ? settings.product_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : []
  const tagId = typeof settings?.tag_id === "string" ? settings.tag_id : ""
  const imageWidth = clampDimension(settings?.image_width)
  const imageHeight = clampDimension(settings?.image_height)

  return {
    ...emptySelectedProduct(),
    title,
    source,
    limit: Math.min(24, Math.max(1, Math.trunc(limit))),
    product_ids: productIds,
    tag_id: tagId,
    image_width: imageWidth,
    image_height: imageHeight,
  }
}

export default function SelectedProductForm({
  value,
  onChange,
}: {
  value: SelectedProductSettings
  onChange: (value: SelectedProductSettings) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProductOption[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<Record<string, ProductOption>>({})
  const requestedIds = useRef(new Set<string>())
  const [tags, setTags] = useState<TagOption[]>([])
  const [tagsError, setTagsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api<{ product_tags?: TagOption[] }>("/admin/product-tags?limit=100&fields=id,value")
      .then((body) => {
        if (!cancelled) {
          setTags(body.product_tags ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTagsError("Etiketler yüklenemedi.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const missing = value.product_ids.filter((id) => !requestedIds.current.has(id))
    if (!missing.length) {
      return
    }

    missing.forEach((id) => requestedIds.current.add(id))
    let cancelled = false
    const params = new URLSearchParams()
    missing.forEach((id) => params.append("id", id))
    params.set("limit", String(missing.length))
    params.set("fields", "id,title,thumbnail")
    api<{ products?: ProductOption[] }>(`/admin/products?${params}`)
      .then((body) => {
        if (cancelled) {
          return
        }
        setPicked((current) => {
          const next = { ...current }
          for (const product of body.products ?? []) {
            next[product.id] = product
          }
          return next
        })
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [value.product_ids])

  useEffect(() => {
    if (value.source !== "editor") {
      return
    }

    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    const handle = setTimeout(() => {
      const params = new URLSearchParams({
        q: term,
        limit: "8",
        fields: "id,title,thumbnail",
      })
      api<{ products?: ProductOption[] }>(`/admin/products?${params}`)
        .then((body) => {
          if (!cancelled) {
            setResults(body.products ?? [])
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults([])
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, value.source])

  const move = (index: number, direction: -1 | 1) => {
    const next = value.product_ids.slice()
    const target = index + direction
    if (target < 0 || target >= next.length) {
      return
    }
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange({ ...value, product_ids: next })
  }

  const handleDimensionChange = (
    field: "image_width" | "image_height",
    raw: string
  ) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      onChange({ ...value, [field]: 0 })
      return
    }
    const next = Number(trimmed)
    if (!Number.isFinite(next)) {
      return
    }
    onChange({
      ...value,
      [field]: clampDimension(next),
    })
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="selected-product-title" size="small">
          Başlık
        </Label>
        <Input
          id="selected-product-title"
          value={value.title}
          placeholder={PRODUCT_SOURCE_LABELS[value.source]}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
        <Text size="small" className="text-ui-fg-subtle">
          Vitrindeki şerit başlığı. Boş bırakılırsa kaynak adı kullanılır.
        </Text>
      </div>
      <div className="flex flex-col gap-y-2">
        <Label size="small">Ürün kaynağı</Label>
        <Select
          value={value.source}
          onValueChange={(source) =>
            onChange({ ...value, source: source as ProductSource })
          }
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {PRODUCT_SOURCES.map((source) => (
              <Select.Item key={source} value={source}>
                {PRODUCT_SOURCE_LABELS[source]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="selected-product-limit" size="small">
          Gösterilecek ürün sayısı
        </Label>
        <Input
          id="selected-product-limit"
          type="number"
          min={1}
          max={24}
          value={String(value.limit)}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (!Number.isFinite(next)) {
              return
            }
            onChange({
              ...value,
              limit: Math.min(24, Math.max(1, Math.trunc(next))),
            })
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-x-3">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="selected-product-image-width" size="small">
            Görsel genişliği (px)
          </Label>
          <Input
            id="selected-product-image-width"
            type="number"
            min={1}
            max={4096}
            placeholder="Otomatik"
            value={value.image_width > 0 ? String(value.image_width) : ""}
            onChange={(event) =>
              handleDimensionChange("image_width", event.target.value)
            }
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="selected-product-image-height" size="small">
            Görsel yüksekliği (px)
          </Label>
          <Input
            id="selected-product-image-height"
            type="number"
            min={1}
            max={4096}
            placeholder="Otomatik"
            value={value.image_height > 0 ? String(value.image_height) : ""}
            onChange={(event) =>
              handleDimensionChange("image_height", event.target.value)
            }
          />
        </div>
      </div>
      {value.source === "editor" ? (
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="selected-product-search" size="small">
            Ürünler
          </Label>
          <Input
            id="selected-product-search"
            value={query}
            placeholder="Ürün adı yazın"
            onChange={(event) => setQuery(event.target.value)}
          />
          {searching ? (
            <Text size="small" className="text-ui-fg-subtle">
              Aranıyor…
            </Text>
          ) : null}
          {results.length > 0 ? (
            <div className="flex flex-col gap-y-1 rounded-md border border-ui-border-base p-2">
              {results.map((product) => {
                const selected = value.product_ids.includes(product.id)
                return (
                  <button
                    key={product.id}
                    type="button"
                    className="flex items-center justify-between gap-x-2 rounded px-2 py-1 text-left text-sm hover:bg-ui-bg-base-hover disabled:opacity-50"
                    disabled={selected}
                    onClick={() => {
                      setPicked((current) => ({ ...current, [product.id]: product }))
                      onChange({
                        ...value,
                        product_ids: [...value.product_ids, product.id],
                      })
                    }}
                  >
                    <span>{product.title || product.id}</span>
                    <span className="text-ui-fg-subtle">{selected ? "Eklendi" : "Ekle"}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
          {value.product_ids.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              Seçilen ürünler bu sırayla vitrinde gösterilir.
            </Text>
          ) : (
            <div className="flex flex-col gap-y-1">
              {value.product_ids.map((id, index) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-x-2 rounded-md border border-ui-border-base px-2 py-1"
                >
                  <Text size="small">{picked[id]?.title || id}</Text>
                  <div className="flex items-center gap-x-1">
                    <Button
                      type="button"
                      size="small"
                      variant="transparent"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      Yukarı
                    </Button>
                    <Button
                      type="button"
                      size="small"
                      variant="transparent"
                      disabled={index === value.product_ids.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      Aşağı
                    </Button>
                    <Button
                      type="button"
                      size="small"
                      variant="transparent"
                      onClick={() =>
                        onChange({
                          ...value,
                          product_ids: value.product_ids.filter((productId) => productId !== id),
                        })
                      }
                    >
                      Kaldır
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
      {value.source === "tagged" ? (
        <div className="flex flex-col gap-y-2">
          <Label size="small">Etiket</Label>
          <Select
            value={value.tag_id || undefined}
            onValueChange={(tagId) => onChange({ ...value, tag_id: tagId })}
          >
            <Select.Trigger>
              <Select.Value placeholder="Etiket seçin" />
            </Select.Trigger>
            <Select.Content>
              {tags.map((tag) => (
                <Select.Item key={tag.id} value={tag.id}>
                  {tag.value || tag.id}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {tagsError ? (
            <Text size="small" className="text-ui-fg-error">
              {tagsError}
            </Text>
          ) : (
            <Text size="small" className="text-ui-fg-subtle">
              Bu etikete sahip ürünler, belirlenen sayı kadar listelenir.
            </Text>
          )}
        </div>
      ) : null}
    </div>
  )
}
