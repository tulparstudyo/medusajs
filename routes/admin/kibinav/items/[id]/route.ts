import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { UpdateNavItemInput } from "../../../../../kibisis/kibinav/types"
import { deleteNavItemWorkflow } from "../../../../../kibisis/kibinav/workflows/delete-nav-item"
import { updateNavItemWorkflow } from "../../../../../kibisis/kibinav/workflows/update-nav-item"

export async function POST(
  req: MedusaRequest<UpdateNavItemInput>,
  res: MedusaResponse
) {
  const { result } = await updateNavItemWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      data: req.validatedBody,
    },
  })

  res.json({ item: result })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await deleteNavItemWorkflow(req.scope).run({
    input: req.params.id,
  })

  res.json({ id: result.id, deleted: true })
}
