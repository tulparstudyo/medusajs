import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"

import { verifyPaymentCallback } from "../../../kibisis/kibipayment/gateway"

function getStorefrontUrl(req: MedusaRequest): string {
  // 1. Explicit query parameter passed from frontend during payment initiation (e.g. https://store.teknovip.net)
  const fromQuery = typeof req.query.storefront === "string" ? req.query.storefront.trim() : ""
  if (fromQuery && (fromQuery.startsWith("https://") || fromQuery.startsWith("http://"))) {
    return fromQuery.replace(/\/+$/, "")
  }

  // 2. Configured STOREFRONT_URL from .env (e.g. https://store.teknovip.net)
  const configured = process.env.STOREFRONT_URL?.trim()
  if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
    return configured.replace(/\/+$/, "")
  }

  // 3. STORE_CORS (find public storefront domain, e.g. https://store.teknovip.net)
  const corsDomain = process.env.STORE_CORS?.split(",")
    .map((u) => u.trim())
    .find((u) => u.startsWith("https://") && !u.includes("localhost") && !u.includes("127.0.0.1"))
  if (corsDomain) {
    return corsDomain.replace(/\/+$/, "")
  }

  // 4. Fallback for single-domain deployments where storefront and backend share the same domain
  const proto = String(req.headers["x-forwarded-proto"] || "https")
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return `${proto}://${host}`.replace(/\/+$/, "")
  }

  // 5. Local development fallback
  return (configured || "http://localhost:8000").replace(/\/+$/, "")
}

function isBrowserRequest(req: MedusaRequest): boolean {
  const accept = String(req.headers.accept || "")
  const dest = String(req.headers["sec-fetch-dest"] || "")
  const mode = String(req.headers["sec-fetch-mode"] || "")
  return accept.includes("text/html") || dest === "document" || mode === "navigate"
}

async function handleCallback(req: MedusaRequest, res: MedusaResponse) {
  const providerId = String(req.query.provider || "iyzico")
  const body = (req.body ?? {}) as Record<string, unknown>
  const token = typeof body.token === "string" ? body.token : (req.query.token as string | undefined)
  const reference = (req.query.reference as string) || (body.conversationId as string) || null
  const cartId = (req.query.cart_id as string) || (body.basketId as string) || null
  const storefront = getStorefrontUrl(req)
  const isBrowser = isBrowserRequest(req)

  try {
    const result = await verifyPaymentCallback(providerId, {
      reference,
      token: token || null,
      body,
      headers: req.headers as Record<string, string | undefined>,
    })

    if (result.status === "captured" || result.status === "authorized") {
      // If we have a cartId, attempt to complete the cart into an order
      if (cartId && req.scope) {
        try {
          const { result: order } = await completeCartWorkflow(req.scope).run({
            input: { id: cartId },
          })
          if (order?.id && isBrowser) {
            const countryCode = String((order as { shipping_address?: { country_code?: string } })?.shipping_address?.country_code || "tr").toLowerCase()
            return res.redirect(303, `${storefront}/${countryCode}/order/${order.id}/confirmed`)
          }
        } catch {
          // If completeCartWorkflow failed (e.g. already completed), continue to redirect
        }
      }

      if (isBrowser) {
        return res.redirect(303, `${storefront}/tr/checkout?step=review&payment_status=success&token=${encodeURIComponent(token || "")}`)
      }

      if (result.acknowledgmentBody) {
        return res.send(result.acknowledgmentBody)
      }
      return res.json({ status: "success", result })
    }

    const errorMsg = result.errorMessage || "Ödeme onaylanmadı."
    if (isBrowser) {
      return res.redirect(303, `${storefront}/tr/checkout?step=payment&error=${encodeURIComponent(errorMsg)}`)
    }
    return res.status(400).json({ status: "failed", message: errorMsg })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ödeme doğrulanamadı."
    if (isBrowser) {
      return res.redirect(303, `${storefront}/tr/checkout?step=payment&error=${encodeURIComponent(message)}`)
    }
    return res.status(400).json({ status: "error", message })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return handleCallback(req, res)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return handleCallback(req, res)
}

