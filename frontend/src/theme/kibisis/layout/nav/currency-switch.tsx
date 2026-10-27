"use client"

import { updateRegion } from "@lib/data/cart"
import { useParams, usePathname } from "next/navigation"
import { ChangeEvent, useMemo, useTransition } from "react"

import { useT } from "../../i18n/client"

export type CurrencyRegion = {
  currency: string
  countries: string[]
}

function currencyLabel(currency: string, locale: string) {
  const code = currency.toUpperCase()
  try {
    const symbol = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value
    return symbol && symbol !== code ? `${code} ${symbol}` : code
  } catch {
    return code
  }
}

export default function CurrencySwitch({
  regions,
  locale,
}: {
  regions: CurrencyRegion[]
  locale: string
}) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  const { countryCode } = useParams<{ countryCode: string }>()
  const pathname = usePathname()
  const country = countryCode?.toLowerCase() ?? ""
  const currentPath = pathname.split(`/${countryCode}`)[1] ?? ""

  const selected =
    regions.find((region) => region.countries.includes(country))?.currency ??
    regions[0]?.currency

  const options = useMemo(() => {
    const byCurrency = new Map<string, string>()
    for (const region of regions) {
      if (!region.countries.length) {
        continue
      }
      if (region.countries.includes(country)) {
        byCurrency.set(region.currency, country)
      } else if (!byCurrency.has(region.currency)) {
        byCurrency.set(region.currency, region.countries[0])
      }
    }
    return Array.from(byCurrency, ([currency, target]) => ({
      currency,
      target,
      label: currencyLabel(currency, locale),
    }))
  }, [regions, country, locale])

  if (!selected || options.length === 0) {
    return null
  }

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const option = options.find((o) => o.currency === event.target.value)
    if (!option || option.currency === selected) {
      return
    }
    startTransition(async () => {
      await updateRegion(option.target, currentPath)
    })
  }

  return (
    <select
      aria-label={t("common.currency")}
      value={selected}
      onChange={onChange}
      disabled={pending}
      className="bg-transparent text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer outline-none disabled:opacity-60"
    >
      {options.map((option) => (
        <option key={option.currency} value={option.currency} className="text-slate-900">
          {option.label}
        </option>
      ))}
    </select>
  )
}
