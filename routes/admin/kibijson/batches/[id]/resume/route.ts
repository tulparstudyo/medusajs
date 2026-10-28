import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resumeBatch } from "../../../../../../kibisis/kibijson/actions"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.json({ batch: await resumeBatch(req.scope, req.params.id) })
}
