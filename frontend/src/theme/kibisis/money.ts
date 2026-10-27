export type FormatMoney = (amount: number, currency: string | null | undefined) => string

export function formatMoney(
  amount: number,
  currency: string | null | undefined,
  locale: string
) {
  const code = (currency || "try").toUpperCase()
  try {
    if (code === "TRY") {
      const value = amount.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      return `${value} TL`
    }

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
}
