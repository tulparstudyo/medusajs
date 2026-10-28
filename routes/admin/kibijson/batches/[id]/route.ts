import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { deleteBatch, getBatchDetail } from "../../../../../kibisis/kibijson/actions"
import { issueLines } from "../../../../../kibisis/kibijson/schema"
import { ItemsQuerySchema } from "../../../../../kibisis/kibijson/validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = ItemsQuerySchema.safeParse(req.query)

  if (!query.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, issueLines(query.error).join("\n"))
  }

  res.json(await getBatchDetail(req.scope, req.params.id, query.data))
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await deleteBatch(req.scope, req.params.id)

  res.json({ id: req.params.id, deleted: true })
}
