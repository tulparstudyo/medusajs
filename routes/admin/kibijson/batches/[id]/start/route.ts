import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { startBatch } from "../../../../../../kibisis/kibijson/actions"
import { StartBatchBody } from "../../../../../../kibisis/kibijson/validators"

export async function POST(req: MedusaRequest<StartBatchBody>, res: MedusaResponse) {
  const batch = await startBatch(req.scope, req.params.id, req.validatedBody)

  res.status(202).json({ batch })
}
