import { Sparkles } from "@medusajs/icons"
import { Button } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"

import AiTranslateModal, { TranslationJob } from "../../kibitranslate/admin/ai-translate-modal"
import { api } from "./api"
import { applySectionResults, collectPageUnits, splitPageResults } from "./section-translation-job"
import { readTranslations } from "./translations-form"
import { ContentLocale, SectionDTO } from "../types"

/**
 * Translates every section of a page in one run. Unlike the per-section form,
 * results are saved straight away because there is no open form to review them in.
 */
export default function PageTranslate({
  sections,
  disabled,
  onTranslated,
}: {
  sections: SectionDTO[]
  disabled?: boolean
  onTranslated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [locales, setLocales] = useState<{ base: string; locales: ContentLocale[] }>({
    base: "",
    locales: [],
  })
  const latest = useRef(sections)
  const changed = useRef(false)

  useEffect(() => {
    latest.current = sections
  }, [sections])

  useEffect(() => {
    api<{ base: string; locales: ContentLocale[] }>("/admin/kibipage/locales")
      .then(setLocales)
      .catch(() => setLocales({ base: "", locales: [] }))
  }, [])

  const job = useMemo<TranslationJob>(
    () => ({
      context: "storefront page section texts such as banners, links and headings",
      collect: (locale, overwrite) => collectPageUnits(latest.current, locale, overwrite),
      apply: async (locale, results) => {
        for (const [sectionId, units] of splitPageResults(results)) {
          const section = latest.current.find((item) => item.id === sectionId)
          if (!section) {
            continue
          }

          const translations = readTranslations(section.settings)
          const response = await api<{ section: SectionDTO }>(
            `/admin/kibipage/sections/${section.id}`,
            {
              method: "POST",
              body: JSON.stringify({
                name: section.name,
                is_active: section.is_active,
                settings: {
                  ...section.settings,
                  translations: {
                    ...translations,
                    [locale]: applySectionResults(translations[locale] ?? {}, units),
                  },
                },
              }),
            }
          )
          changed.current = true
          latest.current = latest.current.map((item) =>
            item.id === section.id ? response.section : item
          )
        }
      },
    }),
    []
  )

  const close = (next: boolean) => {
    setOpen(next)
    if (!next && changed.current) {
      changed.current = false
      onTranslated()
    }
  }

  const hasLocales = locales.locales.length > 0

  return (
    <>
      <Button
        size="small"
        variant="secondary"
        disabled={disabled || !hasLocales || sections.length === 0}
        title={hasLocales ? undefined : "Mağazada temel dil dışında tanımlı dil yok."}
        onClick={() => setOpen(true)}
      >
        <Sparkles />
        Sayfayı tercüme et
      </Button>
      <AiTranslateModal
        open={open}
        onOpenChange={close}
        baseLocale={locales.base}
        locales={locales.locales}
        initialLocales={locales.locales.map((locale) => locale.code)}
        job={job}
        title="Sayfayı tercüme et"
        description="Sayfadaki tüm bölümler çevrilir ve sonuçlar bölümlere hemen kaydedilir."
      />
    </>
  )
}
