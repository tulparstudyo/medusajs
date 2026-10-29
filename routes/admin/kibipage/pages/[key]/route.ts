import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { UpdatePageInput } from "../../../../../kibisis/kibipage/types"
import { deletePageWorkflow } from "../../../../../kibisis/kibipage/workflows/delete-page"
import { updatePageWorkflow } from "../../../../../kibisis/kibipage/workflows/update-page"

export async function POST(
  req: MedusaRequest<UpdatePageInput>,
  res: MedusaResponse
) {
  const { result } = await updatePageWorkflow(req.scope).run({
    input: {
      id: req.params.key,
      data: req.validatedBody,
    },
  })

  res.json({ page: result })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await deletePageWorkflow(req.scope).run({
    input: req.params.key,
  })

  res.json({ id: result.id, deleted: true })
}

