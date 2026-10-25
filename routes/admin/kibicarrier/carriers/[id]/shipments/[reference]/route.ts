import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cancelShipment, trackShipment } from "../../../../../../../kibisis/kibicarrier/gateway"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tracking = await trackShipment(req.scope, req.params.id, req.params.reference)

  res.json({ tracking })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await cancelShipment(req.scope, req.params.id, req.params.reference)

  res.json({ id: req.params.reference, object: "shipment", deleted: true })
}
