import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { rememberRequestOrigin } from "../../../../kibisis/kibicarrier/license-server"
import { carrierCatalog } from "../../../../kibisis/kibicarrier/registry"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  rememberRequestOrigin(req)
  res.json({ catalog: await carrierCatalog() })
}
