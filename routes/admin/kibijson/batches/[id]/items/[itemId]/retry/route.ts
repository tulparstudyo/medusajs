import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { retryItem } from "../../../../../../../../kibisis/kibijson/actions"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.json({ batch: await retryItem(req.scope, req.params.id, req.params.itemId) })
}
