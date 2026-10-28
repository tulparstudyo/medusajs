import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { retryBatch } from "../../../../../../kibisis/kibijson/actions"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.json({ batch: await retryBatch(req.scope, req.params.id) })
}
