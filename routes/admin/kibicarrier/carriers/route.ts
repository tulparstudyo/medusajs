import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { carrierCatalog } from "../../../../kibisis/kibicarrier/registry"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({ catalog: await carrierCatalog() })
}
