import { Sparkles } from "@medusajs/icons"
import { Button, Input, Label, Tabs, Text, Textarea } from "@medusajs/ui"
import { useMemo, useRef, useState } from "react"

import AiTranslateModal, { TranslationJob } from "../../kibitranslate/admin/ai-translate-modal"
import { applySectionResults, collectSectionUnits } from "./section-translation-job"
import {
  ContentLocale,
  SECTION_TRANSLATABLE,
  SectionSettings,
  SectionTranslations,
  SectionType,
  TRANSLATION_FIELD_LABELS,
  TRANSLATION_GROUP_LABELS,
  TranslationLayer,
} from "../types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function readTranslations(settings: SectionSettings | null | undefined): SectionTranslations {
  const value = settings?.translations
  return isRecord(value) ? (value as SectionTranslations) : {}
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function fieldLabel(field: string) {
  return TRANSLATION_FIELD_LABELS[field] ?? field
}

function itemHeading(item: Record<string, unknown>, index: number) {
  return text(item.title).trim() || text(item.label).trim() || `Öğe ${index + 1}`
}

function FieldInput({
  id,
  label,
  base,
  value,
  onChange,
}: {
  id: string
  label: string
  base: string
  value: string
  onChange: (value: string) => void
}) {
  const multiline = id.includes("-html") || label === "HTML içerik"

  return (
    <div className="flex flex-col gap-y-1">
      <Label htmlFor={id} size="small">
        {label}
      </Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          placeholder={base}
          rows={10}
          className="font-mono text-xs"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={base}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}

function LocalePanel({
  type,
  code,
  content,
  layer,
  onChange,
}: {
  type: SectionType
  code: string
  content: SectionSettings
  layer: TranslationLayer
  onChange: (next: TranslationLayer) => void
}) {
  const spec = SECTION_TRANSLATABLE[type]

  const setField = (field: string, value: string) =>
    onChange({ ...layer, fields: { ...layer.fields, [field]: value } })

  const setListField = (list: string, id: string, field: string, value: string) =>
    onChange({
      ...layer,
      lists: {
        ...layer.lists,
        [list]: {
          ...layer.lists?.[list],
          [id]: { ...layer.lists?.[list]?.[id], [field]: value },
        },
      },
    })

  const setGroupField = (group: string, field: string, value: string) =>
    onChange({
      ...layer,
      groups: { ...layer.groups, [group]: { ...layer.groups?.[group], [field]: value } },
    })

  const lists = Object.entries(spec.lists).map(([list, fields]) => ({
    list,
    fields,
    items: (Array.isArray(content[list]) ? content[list] : []).filter(
      (item): item is Record<string, unknown> => isRecord(item) && typeof item.id === "string"
    ),
  }))
  const hasItems = lists.some((entry) => entry.items.length > 0)
  const isEmpty = !spec.fields.length && !Object.keys(spec.groups).length && !hasItems

  return (
    <div className="flex flex-col gap-y-3 pt-3">
      {isEmpty ? (
        <Text size="small" className="text-ui-fg-subtle">
          Önce temel içerikte öğe ekleyin; çeviri alanları öğelere göre oluşur.
        </Text>
      ) : null}
      {spec.fields.map((field) => (
        <FieldInput
          key={field}
          id={`tr-${code}-${field}`}
          label={fieldLabel(field)}
          base={text(content[field])}
          value={text(layer.fields?.[field])}
          onChange={(value) => setField(field, value)}
        />
      ))}
      {Object.entries(spec.groups).map(([group, fields]) => {
        const base = isRecord(content[group]) ? content[group] : {}
        return (
          <div key={group} className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-3">
            <Text size="small" weight="plus">
              {TRANSLATION_GROUP_LABELS[group] ?? group}
            </Text>
            {fields.map((field) => (
              <FieldInput
                key={field}
                id={`tr-${code}-${group}-${field}`}
                label={fieldLabel(field)}
                base={text(base[field])}
                value={text(layer.groups?.[group]?.[field])}
                onChange={(value) => setGroupField(group, field, value)}
              />
            ))}
          </div>
        )
      })}
      {lists.map(({ list, fields, items }) =>
        items.map((item, index) => {
          const id = item.id as string
          return (
            <div
              key={`${list}-${id}`}
              className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-3"
            >
              <Text size="small" weight="plus">
                {itemHeading(item, index)}
              </Text>
              {fields.map((field) => (
                <FieldInput
                  key={field}
                  id={`tr-${code}-${id}-${field}`}
                  label={fieldLabel(field)}
                  base={text(item[field])}
                  value={text(layer.lists?.[list]?.[id]?.[field])}
                  onChange={(value) => setListField(list, id, field, value)}
                />
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

export default function TranslationsForm({
  type,
  baseLocale,
  locales,
  content,
  value,
  onChange,
}: {
  type: SectionType
  baseLocale: string
  locales: ContentLocale[]
  content: SectionSettings
  value: SectionTranslations
  onChange: (next: SectionTranslations) => void
}) {
  const [active, setActive] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const latest = useRef(value)
  latest.current = value
  const current = locales.some((locale) => locale.code === active) ? active : locales[0]?.code ?? ""

  const job = useMemo<TranslationJob>(
    () => ({
      context: "storefront page section texts such as banners, links and headings",
      collect: (locale, overwrite) =>
        collectSectionUnits(type, content, latest.current[locale] ?? {}, overwrite),
      apply: (locale, results) => {
        const next = {
          ...latest.current,
          [locale]: applySectionResults(latest.current[locale] ?? {}, results),
        }
        latest.current = next
        onChange(next)
      },
    }),
    [content, onChange, type]
  )

  if (!locales.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-4">
      <div className="flex items-center justify-between gap-x-3">
        <Label size="small">Çeviriler</Label>
        <Button
          type="button"
          size="small"
          variant="secondary"
          onClick={() => setModalOpen(true)}
        >
          <Sparkles />
          AI translate
        </Button>
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        Yukarıdaki içerik {baseLocale} dilindedir. Diğer diller için çeviri yazın; boş bırakılan
        alanlarda temel içerik gösterilir.
      </Text>
      <AiTranslateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        baseLocale={baseLocale}
        locales={locales}
        initialLocales={current ? [current] : []}
        job={job}
      />
      <Tabs value={current} onValueChange={setActive}>
        <Tabs.List>
          {locales.map((locale) => (
            <Tabs.Trigger key={locale.code} value={locale.code}>
              {locale.name}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {locales.map((locale) => (
          <Tabs.Content key={locale.code} value={locale.code}>
            <LocalePanel
              type={type}
              code={locale.code}
              content={content}
              layer={value[locale.code] ?? {}}
              onChange={(layer) => onChange({ ...value, [locale.code]: layer })}
            />
          </Tabs.Content>
        ))}
      </Tabs>
    </div>
  )
}
