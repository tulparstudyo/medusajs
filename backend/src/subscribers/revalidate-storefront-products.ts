import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

const EVENTS = [
  "product.created",
  "product.updated",
  "product.deleted",
  "product-variant.created",
  "product-variant.updated",
  "product-variant.deleted",
  "product-category.created",
  "product-category.updated",
  "product-category.deleted",
  "product-collection.created",
  "product-collection.updated",
  "product-collection.deleted",
]

export default async function revalidateStorefrontProducts({
  container,
}: SubscriberArgs) {
  const logger = container.resolve("logger")
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET
  const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:8000"

  if (!secret) {
    logger.warn(
      "STOREFRONT_REVALIDATE_SECRET is not set; storefront catalog cache was not cleared."
    )
    return
  }

  try {
    const response = await fetch(
      `${storefrontUrl.replace(/\/$/, "")}/api/revalidate`,
      {
        method: "POST",
        headers: { "x-revalidate-secret": secret },
      }
    )

    if (!response.ok) {
      logger.warn(
        `Storefront catalog cache was not cleared: ${response.status}`
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    logger.warn(`Storefront catalog cache request failed: ${message}`)
  }
}

export const config: SubscriberConfig = {
  event: EVENTS,
}
