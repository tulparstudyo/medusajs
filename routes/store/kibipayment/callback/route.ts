import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { verifyPaymentCallback } from "../../../../kibisis/kibipayment/gateway"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const providerId = String(req.query.provider || "iyzico")
  const body = (req.body ?? {}) as Record<string, unknown>
  const token = typeof body.token === "string" ? body.token : (req.query.token as string | undefined)

  try {
    const result = await verifyPaymentCallback(providerId, {
      reference: (req.query.reference as string) || (body.conversationId as string) || null,
      token: token || null,
      body,
      headers: req.headers as Record<string, string | undefined>,
    })

    if (result.status === "captured" || result.status === "authorized") {
      // Return acknowledgment body if required by provider (e.g. PayTR expects "OK")
      if (result.acknowledgmentBody) {
        return res.send(result.acknowledgmentBody)
      }
      return res.json({ status: "success", result })
    }

    return res.status(400).json({ status: "failed", message: result.errorMessage })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ödeme doğrulanamadı."
    return res.status(400).json({ status: "error", message })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shopUrl = process.env.STORE_CORS?.split(",")[0] || "http://localhost:8000"
  const token = req.query.token as string | undefined

  if (token) {
    return res.redirect(`${shopUrl}/checkout?step=review&token=${token}`)
  }

  res.redirect(`${shopUrl}/checkout?step=payment`)
}

