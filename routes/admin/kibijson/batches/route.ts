import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { createBatch, listBatchPage } from "../../../../kibisis/kibijson/actions"
import { CreateBatchBody } from "../../../../kibisis/kibijson/validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await listBatchPage(req.scope))
}

export async function POST(req: AuthenticatedMedusaRequest<CreateBatchBody>, res: MedusaResponse) {
  const batch = await createBatch(req.scope, {
    ...req.validatedBody,
    created_by: req.auth_context?.actor_id ?? null,
  })

  res.status(201).json({ batch })
}
