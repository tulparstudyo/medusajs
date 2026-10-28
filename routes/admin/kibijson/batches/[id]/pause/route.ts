import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { pauseBatch } from "../../../../../../kibisis/kibijson/actions"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.json({ batch: await pauseBatch(req.scope, req.params.id) })
}
