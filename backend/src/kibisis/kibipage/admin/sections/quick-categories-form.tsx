import { Button, Input, Label, Select } from "@medusajs/ui"
import { useState } from "react"

import { IconSelect } from "../icon-select"
import { QUICK_CATEGORY_TONES, QuickCategoryItem, QuickCategoryTone, isSectionIcon } from "../../types"

const TONE_LABELS: Record<QuickCategoryTone, string> = {
  rose: "Gül",
  blue: "Mavi",
  amber: "Kehribar",
  emerald: "Zümrüt",
  indigo: "İndigo",
  "amber-dark": "Koyu kehribar",
  stone: "Taş",
  pink: "Pembe",
  orange: "Turuncu",
  slate: "Arduvaz",
  cyan: "Camgöbeği",
  purple: "Mor",
}

export type QuickCategoriesSettings = {
  items: QuickCategoryItem[]
}

export const emptyQuickCategory = (): QuickCategoryItem => ({
  id: crypto.randomUUID(),
  icon: "sparkles",
  title: "",
  label: "",
  href: "/",
  tone: "orange",
})

const emptySettings = (): QuickCategoriesSettings => ({ items: [] })

export function readQuickCategories(settings: unknown): QuickCategoriesSettings {
  if (!settings || typeof settings !== "object" || !("items" in settings)) {
    return emptySettings()
  }

  const items = (settings as { items?: unknown }).items
  if (!Array.isArray(items)) {
    return emptySettings()
  }

  return {
    items: items.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return []
      }

      const row = item as Partial<QuickCategoryItem>
      const tone = QUICK_CATEGORY_TONES.find((entry) => entry === row.tone) ?? "orange"
      const icon = isSectionIcon(row.icon) ? row.icon : "sparkles"
      return [
        {
          id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
          icon,
          title: typeof row.title === "string" ? row.title : "",
          label: typeof row.label === "string" ? row.label : "",
          href: typeof row.href === "string" ? row.href : "/",
          tone,
        },
      ]
    }),
  }
}

export default function QuickCategoriesForm({
  value,
  onChange,
}: {
  value: QuickCategoriesSettings
  onChange: (next: QuickCategoriesSettings) => void
}) {
  const items = value.items
  const [openIds, setOpenIds] = useState<string[]>([])

  const toggle = (id: string) => {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  const update = (id: string, patch: Partial<QuickCategoryItem>) => {
    onChange({
      items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) {
      return
    }

    const next = items.slice()
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange({ items: next })
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Label size="small">Kategoriler</Label>
      {items.length === 0 && (
        <p className="text-ui-fg-subtle text-sm">
          Henüz kategori yok. Eklenen her satır vitrinde bir daire olur. Satır yoksa bölüm görünmez.
        </p>
      )}
      {items.map((item, index) => {
        const open = openIds.includes(item.id)
          const heading = item.title.trim() || `Öğe ${index + 1}`
        const panelId = `qc-panel-${item.id}`

        return (
        <div
          key={item.id}
          className="overflow-hidden rounded-lg border border-ui-border-base"
        >
          <div className="flex items-center gap-x-2 px-3 py-2">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-x-2 text-left"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => toggle(item.id)}
            >
              <span
                className={`text-ui-fg-muted inline-block text-xs transition-transform ${
                  open ? "rotate-90" : ""
                }`}
              >
                ›
              </span>
              <span className="truncate text-sm font-medium">{heading}</span>
              {item.label && (
                <span className="text-ui-fg-subtle truncate text-xs">{item.label}</span>
              )}
            </button>
            <div className="flex shrink-0 gap-x-2">
              <Button
                type="button"
                size="small"
                variant="secondary"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                Yukarı
              </Button>
              <Button
                type="button"
                size="small"
                variant="secondary"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                Aşağı
              </Button>
              <Button
                type="button"
                size="small"
                variant="danger"
                onClick={() => {
                  onChange({ items: items.filter((row) => row.id !== item.id) })
                  setOpenIds((current) => current.filter((entry) => entry !== item.id))
                }}
              >
                Sil
              </Button>
            </div>
          </div>
          {open && (
          <div id={panelId} className="flex flex-col gap-y-3 border-t border-ui-border-base px-3 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-y-2">
              <Label size="small">İkon</Label>
              <IconSelect
                value={item.icon}
                onChange={(icon) => update(item.id, { icon })}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small" htmlFor={`qc-title-${item.id}`}>
                Ad
              </Label>
              <Input
                id={`qc-title-${item.id}`}
                value={item.title}
                onChange={(event) => update(item.id, { title: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small" htmlFor={`qc-label-${item.id}`}>
                Etiket
              </Label>
              <Input
                id={`qc-label-${item.id}`}
                value={item.label}
                onChange={(event) => update(item.id, { label: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small" htmlFor={`qc-href-${item.id}`}>
                Bağlantı
              </Label>
              <Input
                id={`qc-href-${item.id}`}
                value={item.href}
                onChange={(event) => update(item.id, { href: event.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small">Ton</Label>
            <Select
              value={item.tone}
              onValueChange={(tone: QuickCategoryTone) => update(item.id, { tone })}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {QUICK_CATEGORY_TONES.map((tone) => (
                  <Select.Item key={tone} value={tone}>
                    {TONE_LABELS[tone]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          </div>
          )}
        </div>
        )
      })}
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          const item = emptyQuickCategory()
          onChange({ items: [...items, item] })
          setOpenIds((current) => [...current, item.id])
        }}
      >
        Öğe ekle
      </Button>
    </div>
  )
}
