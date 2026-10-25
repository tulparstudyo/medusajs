import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { createShipment } from "../../../../../../kibisis/kibicarrier/gateway"
import {
  CreateShipmentInput,
  toShipmentRequest,
} from "../../../../../../kibisis/kibicarrier/validators"

export async function POST(req: MedusaRequest<CreateShipmentInput>, res: MedusaResponse) {
  const shipment = await createShipment(req.scope, req.params.id, toShipmentRequest(req.validatedBody))

  res.status(201).json({ shipment })
}
