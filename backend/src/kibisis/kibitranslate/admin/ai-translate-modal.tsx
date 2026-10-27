import { Button, Checkbox, Label, Prompt, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

import {
  fetchTranslateStatus,
  TranslatedUnit,
  translateUnits,
  TranslateStatus,
  TranslationUnit,
} from "./api"

export type TranslationLocale = {
  code: string
  name: string
}

/**
 * Describes what a screen wants translated. Page sections, products,
 * categories and menus each provide their own job; the modal only collects,
 * sends and hands the results back.
 */
export type TranslationJob = {
  /** What the texts are, e.g. "navigation menu labels". */
  context?: string
  /** Texts that still need a translation in the locale, or all of them when overwriting. */
  collect(locale: string, overwrite: boolean): TranslationUnit[]
  /** Writes the translated texts of one locale back to the screen's state, or saves them. */
  apply(locale: string, results: TranslatedUnit[]): void | Promise<void>
}

type Progress = { state: "running" | "done" | "error"; message?: string }

export default function AiTranslateModal({
  open,
  onOpenChange,
  baseLocale,
  locales,
  initialLocales,
  job,
  title = "AI ile çevir",
  description,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  baseLocale: string
  locales: TranslationLocale[]
  initialLocales: string[]
  job: TranslationJob
  title?: string
  description?: string
}) {
  const [status, setStatus] = useState<TranslateStatus | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [overwrite, setOverwrite] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Record<string, Progress>>({})

  useEffect(() => {
    if (!open) {
      return
    }

    setTargets(initialLocales)
    setOverwrite(false)
    setProgress({})
    fetchTranslateStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [open])

  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    if (open) {
      for (const locale of locales) {
        result[locale.code] = job.collect(locale.code, overwrite).length
      }
    }
    return result
  }, [job, locales, open, overwrite])

  const ready = !!status?.enabled && !!status.configured
  const total = targets.reduce((sum, code) => sum + (counts[code] ?? 0), 0)
  const finished = targets.length > 0 && targets.every((code) => progress[code]?.state === "done")

  const toggle = (code: string, checked: boolean) =>
    setTargets((current) =>
      checked ? [...current.filter((item) => item !== code), code] : current.filter((item) => item !== code)
    )

  const run = async () => {
    setRunning(true)

    for (const code of targets) {
      const units = job.collect(code, overwrite)
      if (!units.length) {
        setProgress((current) => ({ ...current, [code]: { state: "done", message: "Çevrilecek metin yok." } }))
        continue
      }

      setProgress((current) => ({ ...current, [code]: { state: "running" } }))
      try {
        const results = await translateUnits({
          source: baseLocale,
          target: code,
          units,
          context: job.context,
        })
        await job.apply(code, results)
        setProgress((current) => ({
          ...current,
          [code]: { state: "done", message: `${results.length} / ${units.length} metin çevrildi.` },
        }))
      } catch (error) {
        setProgress((current) => ({
          ...current,
          [code]: {
            state: "error",
            message: error instanceof Error ? error.message : "Çeviri yapılamadı.",
          },
        }))
      }
    }

    setRunning(false)
  }

  return (
    <Prompt open={open} onOpenChange={(next) => !running && onOpenChange(next)}>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>{title}</Prompt.Title>
          <Prompt.Description>
            {status
              ? `${status.label} ile ${baseLocale} içeriği seçtiğiniz dillere çevrilir. ${
                  description ?? "Sonuçları kaydetmeden önce kontrol edebilirsiniz."
                }`
              : "Çeviri hizmeti bilgisi yükleniyor."}
          </Prompt.Description>
        </Prompt.Header>
        <div className="flex flex-col gap-y-4 px-6 pb-4">
          {status && !ready ? (
            <Text size="small" className="text-ui-fg-error">
              {!status.enabled
                ? "AI çeviri kapalı. Site Ayarları → AI Çeviri bölümünden açın."
                : `${status.label} için kimlik bilgisi girilmemiş. Site Ayarları → AI Çeviri bölümünden ekleyin.`}
            </Text>
          ) : null}
          <div className="flex flex-col gap-y-2">
            <Text size="small" weight="plus">
              Hedef diller
            </Text>
            {locales.map((locale) => {
              const id = `ai-translate-${locale.code}`
              const state = progress[locale.code]
              return (
                <div key={locale.code} className="flex items-start gap-x-2">
                  <Checkbox
                    id={id}
                    checked={targets.includes(locale.code)}
                    disabled={running}
                    onCheckedChange={(checked) => toggle(locale.code, checked === true)}
                  />
                  <div className="flex flex-col">
                    <Label htmlFor={id} size="small">
                      {locale.name}{" "}
                      <span className="text-ui-fg-subtle">({counts[locale.code] ?? 0} metin)</span>
                    </Label>
                    {state?.state === "running" ? (
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Çevriliyor...
                      </Text>
                    ) : state?.message ? (
                      <Text
                        size="xsmall"
                        className={state.state === "error" ? "text-ui-fg-error" : "text-ui-fg-subtle"}
                      >
                        {state.message}
                      </Text>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-start gap-x-2">
            <Checkbox
              id="ai-translate-overwrite"
              checked={overwrite}
              disabled={running}
              onCheckedChange={(checked) => setOverwrite(checked === true)}
            />
            <div className="flex flex-col">
              <Label htmlFor="ai-translate-overwrite" size="small">
                Dolu çevirilerin üzerine yaz
              </Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Kapalıyken yalnızca boş çeviri alanları doldurulur.
              </Text>
            </div>
          </div>
        </div>
        <Prompt.Footer>
          <Button type="button" variant="secondary" disabled={running} onClick={() => onOpenChange(false)}>
            {finished ? "Kapat" : "Vazgeç"}
          </Button>
          <Button
            type="button"
            isLoading={running}
            disabled={!ready || !targets.length || total === 0 || running}
            onClick={() => void run()}
          >
            Çevir ({total})
          </Button>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  )
}
