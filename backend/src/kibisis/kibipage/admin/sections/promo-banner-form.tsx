import { Button, Input, Label, Select, Text } from "@medusajs/ui"
import { useState } from "react"

import {
  BANNER_LAYOUT_LABELS,
  BANNER_LAYOUTS,
  BANNER_TONE_LABELS,
  BANNER_TONES,
  BannerLayout,
  BannerTone,
  emptyPromoBanner,
  PromoBannerItem,
  PromoBannerSettings,
  SectionSettings,
} from "../../types"

export type { PromoBannerSettings }

const layouts = new Set<string>(BANNER_LAYOUTS)
const tones = new Set<string>(BANNER_TONES)

function clampCount(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : fallback
  if (!Number.isFinite(number)) {
    return fallback
  }
  return Math.min(6, Math.max(1, Math.trunc(number)))
}

export function readPromoBanner(
  settings: SectionSettings | null | undefined
): PromoBannerSettings {
  const layoutValue = settings?.layout
  const layout =
    typeof layoutValue === "string" && layouts.has(layoutValue)
      ? (layoutValue as BannerLayout)
      : "grid"
  const storedItems = Array.isArray(settings?.items) ? settings.items : []
  const items = storedItems.flatMap(
    (item) => {
      if (!item || typeof item !== "object") {
        return []
      }
      const row = item as Partial<PromoBannerItem>
      const tone =
        typeof row.tone === "string" && tones.has(row.tone) ? (row.tone as BannerTone) : "stone"
      return [
        {
          id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
          eyebrow: typeof row.eyebrow === "string" ? row.eyebrow : "",
          title: typeof row.title === "string" ? row.title : "",
          text: typeof row.text === "string" ? row.text : "",
          action: typeof row.action === "string" ? row.action : "",
          href: typeof row.href === "string" && row.href ? row.href : "/",
          tone,
        },
      ]
    }
  )

  return {
    ...emptyPromoBanner(),
    layout,
    columns: clampCount(settings?.columns, 3),
    visible: clampCount(settings?.visible, 1),
    items,
  }
}

const emptyItem = (): PromoBannerItem => ({
  id: crypto.randomUUID(),
  eyebrow: "",
  title: "",
  text: "",
  action: "",
  href: "/",
  tone: "stone",
})

export default function PromoBannerForm({
  value,
  onChange,
}: {
  value: PromoBannerSettings
  onChange: (next: PromoBannerSettings) => void
}) {
  const [openIds, setOpenIds] = useState<string[]>([])

  const toggle = (id: string) => {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  const updateItem = (id: string, patch: Partial<PromoBannerItem>) => {
    onChange({
      ...value,
      items: value.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= value.items.length) {
      return
    }
    const next = value.items.slice()
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange({ ...value, items: next })
  }

  const setCount = (key: "columns" | "visible", raw: string) => {
    const next = Number(raw)
    if (!Number.isFinite(next)) {
      return
    }
    onChange({ ...value, [key]: Math.min(6, Math.max(1, Math.trunc(next))) })
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <Label size="small">Gösterim stili</Label>
        <Select
          value={value.layout}
          onValueChange={(layout) => onChange({ ...value, layout: layout as BannerLayout })}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {BANNER_LAYOUTS.map((layout) => (
              <Select.Item key={layout} value={layout}>
                {BANNER_LAYOUT_LABELS[layout]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      {value.layout === "grid" ? (
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="promo-banner-columns" size="small">
            Bir satırdaki öğe sayısı
          </Label>
          <Input
            id="promo-banner-columns"
            type="number"
            min={1}
            max={6}
            value={String(value.columns)}
            onChange={(event) => setCount("columns", event.target.value)}
          />
          <Text size="small" className="text-ui-fg-subtle">
            Dar ekranda tek sütun kalır. Geniş ekranda bu sayı kadar öğe yan yana durur.
          </Text>
        </div>
      ) : null}
      {value.layout === "slider" ? (
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="promo-banner-visible" size="small">
            Aynı anda görünen öğe sayısı
          </Label>
          <Input
            id="promo-banner-visible"
            type="number"
            min={1}
            max={6}
            value={String(value.visible)}
            onChange={(event) => setCount("visible", event.target.value)}
          />
          <Text size="small" className="text-ui-fg-subtle">
            Dar ekranda bir öğe görünür. Geniş ekranda bu sayı kadar öğe birlikte görünür.
          </Text>
        </div>
      ) : null}
      <div className="flex flex-col gap-y-3">
        <Label size="small">Bannerlar</Label>
        {value.items.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            Öğe yoksa bölüm görünmez.
          </Text>
        ) : null}
        {value.items.map((item, index) => {
          const open = openIds.includes(item.id)
          const panelId = `banner-panel-${item.id}`
          const heading = item.title.trim() || `Banner ${index + 1}`

          return (
            <div key={item.id} className="overflow-hidden rounded-lg border border-ui-border-base">
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
                    disabled={index === value.items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Aşağı
                  </Button>
                  <Button
                    type="button"
                    size="small"
                    variant="danger"
                    onClick={() => {
                      onChange({
                        ...value,
                        items: value.items.filter((row) => row.id !== item.id),
                      })
                      setOpenIds((current) => current.filter((entry) => entry !== item.id))
                    }}
                  >
                    Sil
                  </Button>
                </div>
              </div>
              {open ? (
                <div
                  id={panelId}
                  className="flex flex-col gap-y-3 border-t border-ui-border-base px-3 py-3"
                >
                  <div className="flex flex-col gap-y-2">
                    <Label htmlFor={`banner-eyebrow-${item.id}`} size="small">
                      Üst yazı
                    </Label>
                    <Input
                      id={`banner-eyebrow-${item.id}`}
                      value={item.eyebrow}
                      onChange={(event) => updateItem(item.id, { eyebrow: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label htmlFor={`banner-title-${item.id}`} size="small">
                      Başlık
                    </Label>
                    <Input
                      id={`banner-title-${item.id}`}
                      value={item.title}
                      onChange={(event) => updateItem(item.id, { title: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label htmlFor={`banner-text-${item.id}`} size="small">
                      Açıklama
                    </Label>
                    <Input
                      id={`banner-text-${item.id}`}
                      value={item.text}
                      onChange={(event) => updateItem(item.id, { text: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label htmlFor={`banner-action-${item.id}`} size="small">
                      Bağlantı yazısı
                    </Label>
                    <Input
                      id={`banner-action-${item.id}`}
                      value={item.action}
                      onChange={(event) => updateItem(item.id, { action: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label htmlFor={`banner-href-${item.id}`} size="small">
                      Bağlantı
                    </Label>
                    <Input
                      id={`banner-href-${item.id}`}
                      value={item.href}
                      onChange={(event) => updateItem(item.id, { href: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label size="small">Ton</Label>
                    <Select
                      value={item.tone}
                      onValueChange={(tone) => updateItem(item.id, { tone: tone as BannerTone })}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {BANNER_TONES.map((tone) => (
                          <Select.Item key={tone} value={tone}>
                            {BANNER_TONE_LABELS[tone]}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const item = emptyItem()
            onChange({ ...value, items: [...value.items, item] })
            setOpenIds((current) => [...current, item.id])
          }}
        >
          Öğe ekle
        </Button>
      </div>
    </div>
  )
}
