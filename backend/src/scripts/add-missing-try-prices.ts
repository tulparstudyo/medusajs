import type { ExecArgs, Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const CURRENCY = "try"
const FALLBACK_AMOUNT = 1000

type VariantPrices = {
  id: string
  price_set?: { id: string } | null
  prices?: {
    amount: number | string
    currency_code: string
    price_list_id?: string | null
  }[]
}

/**
 * Gives every variant without a TRY price one, so products show up in the Türkiye region.
 * The amount is copied from another price of the same variant. Existing prices are untouched.
 *
 *   npx medusa exec ./src/scripts/add-missing-try-prices.ts
 */
export default async function addMissingTryPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pricing = container.resolve(Modules.PRICING)

  const { data } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "price_set.id",
      "prices.amount",
      "prices.currency_code",
      "prices.price_list_id",
    ],
  })

  const missing = (data as unknown as VariantPrices[]).flatMap((variant) => {
    const prices = (variant.prices ?? []).filter((price) => !price.price_list_id)
    if (!variant.price_set?.id || prices.some((price) => price.currency_code === CURRENCY)) {
      return []
    }

    const amount = Number(prices[0]?.amount)
    return [
      {
        priceSetId: variant.price_set.id,
        prices: [
          {
            currency_code: CURRENCY,
            amount: Number.isFinite(amount) && amount > 0 ? amount : FALLBACK_AMOUNT,
          },
        ],
      },
    ]
  })

  const skipped = data.filter((variant) => !variant.price_set?.id).length
  if (skipped) {
    logger.warn(`add-missing-try-prices: fiyat seti olmayan ${skipped} varyant atlandı.`)
  }

  if (!missing.length) {
    logger.info("add-missing-try-prices: TRY fiyatı eksik varyant yok.")
    return
  }

  await pricing.addPrices(missing)
  logger.info(`add-missing-try-prices: ${missing.length} varyanta TRY fiyatı eklendi.`)

  await revalidateStorefront(logger)
}

async function revalidateStorefront(logger: Logger) {
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET
  const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:8000"
  if (!secret) {
    logger.warn("add-missing-try-prices: STOREFRONT_REVALIDATE_SECRET yok, vitrin önbelleği temizlenmedi.")
    return
  }

  try {
    const response = await fetch(`${storefrontUrl.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { "x-revalidate-secret": secret },
    })
    if (!response.ok) {
      logger.warn(`add-missing-try-prices: vitrin önbelleği temizlenemedi: ${response.status}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    logger.warn(`add-missing-try-prices: vitrin önbelleği isteği başarısız: ${message}`)
  }
}
