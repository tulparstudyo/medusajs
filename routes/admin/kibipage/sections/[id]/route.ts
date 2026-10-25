import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { UpdateSectionInput } from "../../../../../kibisis/kibipage/types"
import { deleteSectionWorkflow } from "../../../../../kibisis/kibipage/workflows/delete-section"
import { updateSectionWorkflow } from "../../../../../kibisis/kibipage/workflows/update-section"

export async function POST(
  req: MedusaRequest<UpdateSectionInput>,
  res: MedusaResponse
) {
  const { result } = await updateSectionWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      data: req.validatedBody,
    },
  })

  res.json({ section: result })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await deleteSectionWorkflow(req.scope).run({
    input: req.params.id,
  })

  res.json({ id: result.id, deleted: true })
}
