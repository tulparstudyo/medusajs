import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getActiveCarrierInfo } from "../../../../kibisis/kibiorder/shipment-service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const activeCarrier = await getActiveCarrierInfo(req.scope)
  res.json({ activeCarrier })
}

