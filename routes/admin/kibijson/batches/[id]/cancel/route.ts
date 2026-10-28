import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cancelBatch } from "../../../../../../kibisis/kibijson/actions"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.json({ batch: await cancelBatch(req.scope, req.params.id) })
}
