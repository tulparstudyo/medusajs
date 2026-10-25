import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ReorderNavInput } from "../../../../kibisis/kibinav/types"
import { reorderNavWorkflow } from "../../../../kibisis/kibinav/workflows/reorder-nav"

export async function POST(
  req: MedusaRequest<ReorderNavInput>,
  res: MedusaResponse
) {
  const { result } = await reorderNavWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.json({ items: result })
}
