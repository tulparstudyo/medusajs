import { Button, Input, Label, Text } from "@medusajs/ui"
import { useState } from "react"

import { IconSelect } from "../icon-select"
import {
  emptyHeroCard,
  HeroCard,
  HeroShowcaseSettings,
  HeroSlide,
  isSectionIcon,
} from "../../types"

export type { HeroShowcaseSettings }

const emptySlide = (): HeroSlide => ({
  id: crypto.randomUUID(),
  image: "",
  href: "/",
})

export function readHeroShowcase(settings: unknown): HeroShowcaseSettings {
  const source =
    settings && typeof settings === "object" ? (settings as Partial<HeroShowcaseSettings>) : {}

  const slides = Array.isArray(source.slides) ? source.slides : []

  return {
    slides: slides.flatMap((slide) => {
      if (!slide || typeof slide !== "object") {
        return []
      }

      const row = slide as Partial<HeroSlide>
      return [
        {
          id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
          image: typeof row.image === "string" ? row.image : "",
          href: typeof row.href === "string" ? row.href : "/",
        },
      ]
    }),
    primary: readCard(source.primary),
    secondary: readCard(source.secondary),
  }
}

function readCard(value: unknown): HeroCard {
  const empty = emptyHeroCard()
  if (!value || typeof value !== "object") {
    return empty
  }

  const row = value as Partial<HeroCard>
  return {
    eyebrow: typeof row.eyebrow === "string" ? row.eyebrow : "",
    title: typeof row.title === "string" ? row.title : "",
    text: typeof row.text === "string" ? row.text : "",
    action: typeof row.action === "string" ? row.action : "",
    href: typeof row.href === "string" ? row.href : "",
    icon: isSectionIcon(row.icon) ? row.icon : "",
  }
}

export default function HeroShowcaseForm({
  value,
  onChange,
}: {
  value: HeroShowcaseSettings
  onChange: (next: HeroShowcaseSettings) => void
}) {
  const [openIds, setOpenIds] = useState<string[]>([])
  const slides = value.slides

  const toggle = (id: string) => {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }

  const updateSlide = (id: string, patch: Partial<HeroSlide>) => {
    onChange({
      ...value,
      slides: slides.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
    })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= slides.length) {
      return
    }

    const next = slides.slice()
    const [slide] = next.splice(index, 1)
    next.splice(target, 0, slide)
    onChange({ ...value, slides: next })
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-3">
        <Label size="small">Sol slayt</Label>
        <Text size="small" className="text-ui-fg-subtle">
          Her slayt bir resimdir. Resim, yazdığınız bağlantının içinde gösterilir.
        </Text>
        {slides.length === 0 && (
          <p className="text-ui-fg-subtle text-sm">Slayt yoksa sol alan görünmez.</p>
        )}
        {slides.map((slide, index) => {
          const open = openIds.includes(slide.id)
          const panelId = `hero-slide-${slide.id}`
          const heading = slide.image.trim() || `Slayt ${index + 1}`

          return (
            <div
              key={slide.id}
              className="overflow-hidden rounded-lg border border-ui-border-base"
            >
              <div className="flex items-center gap-x-2 px-3 py-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-x-2 text-left"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(slide.id)}
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
                    disabled={index === slides.length - 1}
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
                        slides: slides.filter((row) => row.id !== slide.id),
                      })
                      setOpenIds((current) => current.filter((entry) => entry !== slide.id))
                    }}
                  >
                    Sil
                  </Button>
                </div>
              </div>
              {open && (
                <div
                  id={panelId}
                  className="flex flex-col gap-y-3 border-t border-ui-border-base px-3 py-3"
                >
                  <div className="flex flex-col gap-y-2">
                    <Label size="small" htmlFor={`hero-image-${slide.id}`}>
                      Resim adresi
                    </Label>
                    <Input
                      id={`hero-image-${slide.id}`}
                      value={slide.image}
                      placeholder="https:// veya /gorsel.jpg"
                      onChange={(event) => updateSlide(slide.id, { image: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label size="small" htmlFor={`hero-href-${slide.id}`}>
                      Bağlantı
                    </Label>
                    <Input
                      id={`hero-href-${slide.id}`}
                      value={slide.href}
                      onChange={(event) => updateSlide(slide.id, { href: event.target.value })}
                    />
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
            const slide = emptySlide()
            onChange({ ...value, slides: [...slides, slide] })
            setOpenIds((current) => [...current, slide.id])
          }}
        >
          Slayt ekle
        </Button>
      </div>
      <CardFields
        title="Sağ üst kart"
        prefix="primary"
        value={value.primary}
        onChange={(primary) => onChange({ ...value, primary })}
      />
      <CardFields
        title="Sağ alt kart"
        prefix="secondary"
        value={value.secondary}
        onChange={(secondary) => onChange({ ...value, secondary })}
      />
    </div>
  )
}

function CardFields({
  title,
  prefix,
  value,
  onChange,
}: {
  title: string
  prefix: string
  value: HeroCard
  onChange: (next: HeroCard) => void
}) {
  const set = (patch: Partial<HeroCard>) => onChange({ ...value, ...patch })

  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-3">
      <Label size="small">{title}</Label>
      <div className="grid grid-cols-2 gap-3">
        <Field
          id={`${prefix}-eyebrow`}
          label="Üst yazı"
          value={value.eyebrow}
          onChange={(eyebrow) => set({ eyebrow })}
        />
        <div className="flex flex-col gap-y-2">
          <Label size="small">İkon</Label>
          <IconSelect
            allowEmpty
            value={value.icon}
            onChange={(icon) => set({ icon })}
          />
        </div>
      </div>
      <Field
        id={`${prefix}-title`}
        label="Başlık"
        value={value.title}
        onChange={(next) => set({ title: next })}
      />
      <Field
        id={`${prefix}-text`}
        label="Açıklama"
        value={value.text}
        onChange={(text) => set({ text })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          id={`${prefix}-action`}
          label="Bağlantı yazısı"
          value={value.action}
          onChange={(action) => set({ action })}
        />
        <Field
          id={`${prefix}-href`}
          label="Bağlantı"
          value={value.href}
          onChange={(href) => set({ href })}
        />
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small" htmlFor={id}>
        {label}
      </Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
