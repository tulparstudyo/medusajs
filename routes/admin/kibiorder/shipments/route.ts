import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  createBulkShipments,
  listOrderShipments,
} from "../../../../kibisis/kibiorder/shipment-service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.query.order_id as string | undefined
  const shipments = await listOrderShipments(req.scope, orderId)
  res.json({ shipments })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { order_ids } = req.body as { order_ids?: string[] }

  if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "En az bir sipariş kimliği (order_ids) gereklidir."
    )
  }

  const result = await createBulkShipments(req.scope, order_ids)

  res.status(201).json(result)
}

