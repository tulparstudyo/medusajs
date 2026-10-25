/**
 * roundMoney rounds half up to two decimals. A negative amount is refused.
 */
export function roundMoney(value: string | number): string | null {
  const raw = String(value).trim()

  if (raw === "") {
    return null
  }

  const numeric = Number(raw)

  if (!Number.isFinite(numeric)) {
    return null
  }

  if (numeric < 0) {
    return null
  }

  const unsigned = raw.startsWith("+") ? raw.slice(1) : raw
  const plain = /^-?\d+(\.\d+)?$/.test(unsigned) ? unsigned : numeric.toFixed(8)
  const [whole, fraction = ""] = plain.split(".")
  const digits = `${fraction}000`.slice(0, 3)
  let cents = Number(whole) * 100 + Number(digits.slice(0, 2))

  if (digits[2] >= "5") {
    cents += 1
  }

  return (cents / 100).toFixed(2)
}

export function compareMoney(left: string, right: string): number {
  const a = Number(left)
  const b = Number(right)

  if (a === b) {
    return 0
  }

  return a > b ? 1 : -1
}
