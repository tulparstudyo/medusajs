import { Sparkles } from "@medusajs/icons"
import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

import AiTranslateModal, { TranslationLocale } from "./ai-translate-modal"
import { request } from "./api"
import { createEntityTranslationJob, EntityTarget, loadEntityGroups } from "./entity-translation"
import { EntityGroup } from "./entity-translation-job"
import { isUnfiltered, TableQuerySpec, tableListQuery } from "./table-query"

const PAGE_SIZE = 100
const MAX_RECORDS = 1000

/** Describes one admin list page whose filtered records can be translated in bulk. */
export type BulkTranslateConfig<T extends { id: string }> = {
  /** Admin list API, e.g. /admin/collections. */
  listPath: string
  /** Key of the records in the list response, e.g. "collections". */
  listKey: string
  /** Fields to request; only what `targets` needs. */
  fields: string
  query: TableQuerySpec
  /** Translation Module entities to translate for the listed records. */
  targets: (records: T[]) => EntityTarget[]
  context: string
  /** Singular noun for messages, e.g. "koleksiyon". */
  noun: string
  intro: string
  buttonLabel: string
  disabledMessage: string
}

async function listRecords<T extends { id: string }>(
  config: BulkTranslateConfig<T>,
  filters: URLSearchParams
): Promise<{ records: T[]; count: number }> {
  const records: T[] = []
  let count = 0

  for (let offset = 0; offset === 0 || offset < count; offset += PAGE_SIZE) {
    const query = new URLSearchParams(filters)
    query.set("fields", config.fields)
    query.set("limit", String(PAGE_SIZE))
    query.set("offset", String(offset))

    const page = await request<Record<string, unknown> & { count: number }>(
      `${config.listPath}?${query}`
    )
    const items = (page[config.listKey] as T[] | undefined) ?? []
    count = page.count
    if (count > MAX_RECORDS) {
      break
    }
    records.push(...items)
    if (!items.length) {
      break
    }
  }

  return { records, count }
}

/**
 * Translates every record of an admin list that matches the table's current
 * filters (all pages, not just the visible one) with the AI translate modal.
 */
export default function BulkTranslateWidget<T extends { id: string }>({
  config,
}: {
  config: BulkTranslateConfig<T>
}) {
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scope, setScope] = useState("")
  const [locales, setLocales] = useState<{ base: string; locales: TranslationLocale[] }>({
    base: "",
    locales: [],
  })
  const groups = useRef<EntityGroup[]>([])
  const job = useMemo(() => createEntityTranslationJob(groups, config.context), [config.context])

  const start = async () => {
    const filters = tableListQuery(searchParams, config.query)
    setLoading(true)
    try {
      const [contentLocales, list] = await Promise.all([
        request<{ base: string; locales: TranslationLocale[] }>("/admin/kibipage/locales"),
        listRecords(config, filters),
      ])

      if (!contentLocales.locales.length) {
        toast.error("Mağazada temel dil dışında tanımlı dil yok.")
        return
      }
      if (!list.count) {
        toast.error(`Filtreye uyan ${config.noun} yok.`)
        return
      }
      if (list.count > MAX_RECORDS) {
        toast.error(
          `Filtreye uyan ${list.count} ${config.noun} var. Bir seferde en fazla ${MAX_RECORDS} ${config.noun} çevrilebilir; filtreyi daraltın.`
        )
        return
      }

      const loaded = await loadEntityGroups(config.targets(list.records))
      if (!loaded.length) {
        toast.error(config.disabledMessage)
        return
      }

      groups.current = loaded
      setLocales(contentLocales)
      setScope(
        isUnfiltered(filters)
          ? `Filtre uygulanmadığı için tüm kayıtlar (${list.records.length} ${config.noun})`
          : `Filtreye uyan ${list.records.length} ${config.noun}`
      )
      setOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kayıtlar yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <div>
        <Heading level="h2">Çeviri</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {config.intro}
        </Text>
      </div>
      <Button size="small" variant="secondary" isLoading={loading} onClick={() => void start()}>
        <Sparkles />
        {config.buttonLabel}
      </Button>
      <AiTranslateModal
        open={open}
        onOpenChange={setOpen}
        baseLocale={locales.base}
        locales={locales.locales}
        initialLocales={locales.locales.map((locale) => locale.code)}
        job={job}
        title={config.buttonLabel}
        description={`${scope} çevrilir ve sonuçlar hemen kaydedilir.`}
      />
    </Container>
  )
}
