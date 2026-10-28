import { PriceEntry } from "./types"

export type PriceInput = {
  id?: string
  amount: number
  currency_code: string
  min_quantity?: number
  max_quantity?: number
  rules?: Record<string, string>
}

export type PriceRow = {
  id: string
  amount: number
  currency_code: string
  min_quantity: number | null
  max_quantity: number | null
  rules: Record<string, string>
}

export function pricesFor(amount: string | null, currency: string): PriceInput[] | undefined {
  if (!amount) {
    return undefined
  }

  return [{ amount: Number(amount), currency_code: currency }]
}

/**
 * MergePrices replaces the variant's plain price in the import currency and
 * keeps every other price, so amounts entered for other currencies or regions
 * survive a re-import.
 */
export function mergePrices(
  existing: PriceRow[],
  amount: string | null,
  currency: string
): PriceInput[] {
  const isTarget = (price: PriceRow) =>
    price.currency_code === currency && Object.keys(price.rules).length === 0
  const target = existing.find(isTarget)
  const kept: PriceInput[] = existing
    .filter((price) => !isTarget(price))
    .map((price) => ({
      id: price.id,
      amount: price.amount,
      currency_code: price.currency_code,
      ...(price.min_quantity === null ? {} : { min_quantity: price.min_quantity }),
      ...(price.max_quantity === null ? {} : { max_quantity: price.max_quantity }),
      rules: price.rules,
    }))

  if (!amount) {
    return kept
  }

  return [
    ...kept,
    {
      ...(target ? { id: target.id } : {}),
      amount: Number(amount),
      currency_code: currency,
    },
  ]
}

export function pricesOfEntries(entries: PriceEntry[]): PriceInput[] | undefined {
  if (!entries.length) {
    return undefined
  }

  return entries.map((entry) => ({ amount: Number(entry.amount), currency_code: entry.currency }))
}

/**
 * MergeEntryPrices replaces the plain price of every currency in entries and
 * keeps the rest: region or quantity prices and currencies the document
 * does not mention.
 */
export function mergeEntryPrices(existing: PriceRow[], entries: PriceEntry[]): PriceInput[] {
  const currencies = new Set(entries.map((entry) => entry.currency))
  const isTarget = (price: PriceRow) =>
    currencies.has(price.currency_code) &&
    Object.keys(price.rules).length === 0 &&
    price.min_quantity === null &&
    price.max_quantity === null
  const kept: PriceInput[] = existing
    .filter((price) => !isTarget(price))
    .map((price) => ({
      id: price.id,
      amount: price.amount,
      currency_code: price.currency_code,
      ...(price.min_quantity === null ? {} : { min_quantity: price.min_quantity }),
      ...(price.max_quantity === null ? {} : { max_quantity: price.max_quantity }),
      rules: price.rules,
    }))

  return [
    ...kept,
    ...entries.map((entry) => {
      const target = existing.find((price) => isTarget(price) && price.currency_code === entry.currency)

      return {
        ...(target ? { id: target.id } : {}),
        amount: Number(entry.amount),
        currency_code: entry.currency,
      }
    }),
  ]
}
