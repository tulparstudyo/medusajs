import { Button, Input, Label, Select, Text, Textarea } from "@medusajs/ui"
import { useState } from "react"

import { IconSelect } from "../icon-select"
import {
  emptyIconBox,
  ICON_BOX_TONE_LABELS,
  ICON_BOX_TONES,
  IconBoxItem,
  IconBoxSettings,
  IconBoxTone,
  isSectionIcon,
  SectionSettings,
} from "../../types"

export type { IconBoxSettings }

const tones = new Set<string>(ICON_BOX_TONES)

export function readIconBox(settings: SectionSettings | null | undefined): IconBoxSettings {
  const stored = Array.isArray(settings?.items) ? settings.items : []

  return {
    ...emptyIconBox(),
    items: stored.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return []
      }
      const row = item as Partial<IconBoxItem>
      const tone = typeof row.tone === "string" && tones.has(row.tone) ? row.tone : "orange"
      return [
        {
          id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
          icon: isSectionIcon(row.icon) ? row.icon : "sparkles",
          title: typeof row.title === "string" ? row.title : "",
          text: typeof row.text === "string" ? row.text : "",
          tone: tone as IconBoxTone,
        },
      ]
    }),
  }
}

const emptyItem = (): IconBoxItem => ({
  id: crypto.randomUUID(),
  icon: "sparkles",
  title: "",
  text: "",
  tone: "orange",
})

export default function IconBoxForm({
  value,
  onChange,
}: {
  value: IconBoxSettings
  onChange: (next: IconBoxSettings) => void
}) {
  const [openIds, setOpenIds] = useState<string[]>([])

  const toggle = (id: string) => {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  const updateItem = (id: string, patch: Partial<IconBoxItem>) => {
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
    <div className="flex flex-col gap-y-3">
      <Label size="small">Kutular</Label>
      {value.items.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">
          Öğe yoksa bölüm görünmez.
        </Text>
      ) : null}
      {value.items.map((item, index) => {
        const open = openIds.includes(item.id)
        const panelId = `icon-box-${item.id}`
        const heading = item.title.trim() || `Kutu ${index + 1}`

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
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-y-2">
                    <Label size="small">İkon</Label>
                    <IconSelect
                      value={item.icon}
                      onChange={(icon) => updateItem(item.id, { icon })}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label size="small">Renk</Label>
                    <Select
                      value={item.tone}
                      onValueChange={(tone) => updateItem(item.id, { tone: tone as IconBoxTone })}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {ICON_BOX_TONES.map((tone) => (
                          <Select.Item key={tone} value={tone}>
                            {ICON_BOX_TONE_LABELS[tone]}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor={`box-title-${item.id}`} size="small">
                    Başlık
                  </Label>
                  <Input
                    id={`box-title-${item.id}`}
                    value={item.title}
                    onChange={(event) => updateItem(item.id, { title: event.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor={`box-text-${item.id}`} size="small">
                    Metin
                  </Label>
                  <Textarea
                    id={`box-text-${item.id}`}
                    value={item.text}
                    onChange={(event) => updateItem(item.id, { text: event.target.value })}
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
  )
}
