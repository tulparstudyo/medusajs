import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { rememberRequestOrigin } from "../../../../kibisis/kibicarrier/license-server"
import { paymentCatalog } from "../../../../kibisis/kibipayment/registry"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  rememberRequestOrigin(req)
  res.json({ catalog: await paymentCatalog() })
}

