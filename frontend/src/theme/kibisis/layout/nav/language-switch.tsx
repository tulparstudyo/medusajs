"use client"

import { updateLocale } from "@lib/data/locale-actions"
import type { Locale } from "@lib/data/locales"
import { useRouter } from "next/navigation"
import { ChangeEvent, useTransition } from "react"

import { useT } from "../../i18n/client"

function nativeName(code: string, fallback: string) {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code.split("-")[0])
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : fallback
  } catch {
    return fallback
  }
}

function sameLanguage(code: string, lang: string) {
  return code.toLowerCase().split("-")[0] === lang.toLowerCase().split("-")[0]
}

export default function LanguageSwitch({
  locales,
  current,
  fallback,
}: {
  locales: Locale[]
  current: string | null
  fallback: string
}) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const selected =
    locales.find((locale) => current && locale.code.toLowerCase() === current.toLowerCase()) ??
    locales.find((locale) => sameLanguage(locale.code, fallback)) ??
    locales[0]

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const code = event.target.value
    startTransition(async () => {
      await updateLocale(code)
      router.refresh()
    })
  }

  return (
    <select
      aria-label={t("common.language")}
      value={selected.code}
      onChange={onChange}
      disabled={pending}
      className="bg-transparent text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer outline-none disabled:opacity-60"
    >
      {locales.map((locale) => (
        <option key={locale.code} value={locale.code} className="text-slate-900">
          {nativeName(locale.code, locale.name)}
        </option>
      ))}
    </select>
  )
}
