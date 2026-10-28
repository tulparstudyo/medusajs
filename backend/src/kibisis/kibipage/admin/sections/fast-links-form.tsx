import { Button, Input, Label, Select, Switch, Text } from "@medusajs/ui"
import { useState } from "react"

import SectionImageField from "../section-image-field"
import {
  emptyFastLinks,
  FAST_LINK_VARIANT_LABELS,
  FAST_LINK_VARIANTS,
  FastLinkItem,
  FastLinksSettings,
  FastLinkVariant,
  SectionSettings,
} from "../../types"

export type { FastLinksSettings }

const variants = new Set<string>(FAST_LINK_VARIANTS)

export function readFastLinks(
  settings: SectionSettings | null | undefined
): FastLinksSettings {
  const variantValue = settings?.variant
  const variant =
    typeof variantValue === "string" && variants.has(variantValue)
      ? (variantValue as FastLinkVariant)
      : "outline"
  const stored = Array.isArray(settings?.items) ? settings.items : []

  return {
    ...emptyFastLinks(),
    title: typeof settings?.title === "string" ? settings.title : "",
    variant,
    items: stored.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return []
      }
      const row = item as Partial<FastLinkItem>
      return [
        {
          id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
          label: typeof row.label === "string" ? row.label : "",
          href: typeof row.href === "string" && row.href ? row.href : "/",
          icon: typeof row.icon === "string" ? row.icon : "",
          accent: row.accent === true,
        },
      ]
    }),
  }
}

const emptyItem = (): FastLinkItem => ({
  id: crypto.randomUUID(),
  label: "",
  href: "/",
  icon: "",
  accent: false,
})

export default function FastLinksForm({
  sectionId,
  value,
  onChange,
}: {
  sectionId: string
  value: FastLinksSettings
  onChange: (next: FastLinksSettings) => void
}) {
  const [openIds, setOpenIds] = useState<string[]>([])

  const toggle = (id: string) => {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  const updateItem = (id: string, patch: Partial<FastLinkItem>) => {
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

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="fast-links-title" size="small">
          Başlık
        </Label>
        <Input
          id="fast-links-title"
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label size="small">Görünüm</Label>
        <Select
          value={value.variant}
          onValueChange={(variant) =>
            onChange({ ...value, variant: variant as FastLinkVariant })
          }
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {FAST_LINK_VARIANTS.map((variant) => (
              <Select.Item key={variant} value={variant}>
                {FAST_LINK_VARIANT_LABELS[variant]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <Text size="small" className="text-ui-fg-subtle">
          Çerçeveli, marka etiketleri gibi kenarlıklı durur. Hap, arama etiketleri gibi yuvarlaktır.
        </Text>
      </div>
      <div className="flex flex-col gap-y-3">
        <Label size="small">Bağlantılar</Label>
        {value.items.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            Öğe yoksa bölüm görünmez.
          </Text>
        ) : null}
        {value.items.map((item, index) => {
          const open = openIds.includes(item.id)
          const panelId = `fast-link-${item.id}`
          const heading = item.label.trim() || `Bağlantı ${index + 1}`

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
                  <SectionImageField
                    sectionId={sectionId}
                    label="İkon"
                    value={item.icon}
                    onChange={(icon) => updateItem(item.id, { icon })}
                  />
                  <div className="flex flex-col gap-y-2">
                    <Label htmlFor={`fast-label-${item.id}`} size="small">
                      Metin
                    </Label>
                    <Input
                      id={`fast-label-${item.id}`}
                      value={item.label}
                      onChange={(event) => updateItem(item.id, { label: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label htmlFor={`fast-href-${item.id}`} size="small">
                      Bağlantı
                    </Label>
                    <Input
                      id={`fast-href-${item.id}`}
                      value={item.href}
                      onChange={(event) => updateItem(item.id, { href: event.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-x-3">
                    <Label htmlFor={`fast-accent-${item.id}`} size="small">
                      Vurgulu
                    </Label>
                    <Switch
                      id={`fast-accent-${item.id}`}
                      checked={item.accent}
                      onCheckedChange={(accent) => updateItem(item.id, { accent })}
                    />
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
