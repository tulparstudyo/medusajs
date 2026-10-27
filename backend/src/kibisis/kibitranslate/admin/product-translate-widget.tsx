import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Sparkles } from "@medusajs/icons"
import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMemo, useRef, useState } from "react"

import AiTranslateModal, { TranslationLocale } from "./ai-translate-modal"
import { request } from "./api"
import { EntityGroup } from "./entity-translation-job"
import {
  createProductTranslationJob,
  loadProductGroups,
  PRODUCT_ID_FIELDS,
  ProductIds,
} from "./product-translation"

export default function ProductTranslateWidget({ data: product }: DetailWidgetProps<AdminProduct>) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [locales, setLocales] = useState<{ base: string; locales: TranslationLocale[] }>({
    base: "",
    locales: [],
  })
  const groups = useRef<EntityGroup[]>([])
  const job = useMemo(() => createProductTranslationJob(groups), [])

  const start = async () => {
    setLoading(true)
    try {
      const [contentLocales, ids] = await Promise.all([
        request<{ base: string; locales: TranslationLocale[] }>("/admin/kibipage/locales"),
        request<{ product: ProductIds }>(`/admin/products/${product.id}?fields=${PRODUCT_ID_FIELDS}`),
      ])

      if (!contentLocales.locales.length) {
        toast.error("Mağazada temel dil dışında tanımlı dil yok.")
        return
      }

      const loaded = await loadProductGroups([ids.product])
      if (!loaded.length) {
        toast.error("Ürünler için çeviri kapalı. Ayarlar → Çeviriler bölümünden açın.")
        return
      }

      setLocales(contentLocales)
      groups.current = loaded
      setOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Çeviri bilgileri yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <div>
        <Heading level="h2">Çeviri</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Ürün adı, açıklama, malzeme, varyant ve seçenek adlarını mağaza dillerine çevirin.
        </Text>
      </div>
      <Button size="small" variant="secondary" isLoading={loading} onClick={() => void start()}>
        <Sparkles />
        Ürünü tercüme et
      </Button>
      <AiTranslateModal
        open={open}
        onOpenChange={setOpen}
        baseLocale={locales.base}
        locales={locales.locales}
        initialLocales={locales.locales.map((locale) => locale.code)}
        job={job}
        title="Ürünü tercüme et"
        description="Ürünün, varyantlarının ve seçeneklerinin çevrilebilir alanları çevrilir ve hemen kaydedilir."
      />
    </Container>
  )
}
