import { Sparkles } from "@medusajs/icons"
import { Button, toast } from "@medusajs/ui"
import { useMemo, useRef, useState } from "react"

import AiTranslateModal, { TranslationLocale } from "../../kibitranslate/admin/ai-translate-modal"
import { createEntityTranslationJob, loadEntityGroups } from "../../kibitranslate/admin/entity-translation"
import { EntityGroup } from "../../kibitranslate/admin/entity-translation-job"
import { api } from "./api"
import { NAV_MENUS, NavItemDTO } from "../types"

const NAV_ENTITY = "kibinav_item"

/** Translates the labels of every menu (top bar, main, footer, footer bottom) in one run. */
export default function NavTranslate({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(0)
  const [locales, setLocales] = useState<{ base: string; locales: TranslationLocale[] }>({
    base: "",
    locales: [],
  })
  const groups = useRef<EntityGroup[]>([])
  const job = useMemo(
    () => createEntityTranslationJob(groups, "navigation menu labels of an online store"),
    []
  )

  const start = async () => {
    setLoading(true)
    try {
      const [contentLocales, ...menus] = await Promise.all([
        api<{ base: string; locales: TranslationLocale[] }>("/admin/kibipage/locales"),
        ...NAV_MENUS.map((menu) => api<{ items: NavItemDTO[] }>(`/admin/kibinav/items?menu=${menu}`)),
      ])
      const ids = menus.flatMap((menu) => menu.items.map((item) => item.id))

      if (!contentLocales.locales.length) {
        toast.error("Mağazada temel dil dışında tanımlı dil yok.")
        return
      }
      if (!ids.length) {
        toast.error("Menülerde çevrilecek öğe yok.")
        return
      }

      const loaded = await loadEntityGroups([[NAV_ENTITY, ids]])
      if (!loaded.length) {
        toast.error("Menü öğeleri için çeviri kapalı. Ayarlar → Çeviriler bölümünden açın.")
        return
      }

      groups.current = loaded
      setLocales(contentLocales)
      setCount(ids.length)
      setOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Menüler yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        size="small"
        variant="secondary"
        disabled={disabled}
        isLoading={loading}
        onClick={() => void start()}
      >
        <Sparkles />
        Menüleri tercüme et
      </Button>
      <AiTranslateModal
        open={open}
        onOpenChange={setOpen}
        baseLocale={locales.base}
        locales={locales.locales}
        initialLocales={locales.locales.map((locale) => locale.code)}
        job={job}
        title="Menüleri tercüme et"
        description={`Üst Bar, Ana Menü, Footer ve Footer Alt menülerindeki ${count} öğenin adı çevrilir ve hemen kaydedilir.`}
      />
    </>
  )
}
