import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { DeleteMemoryInput } from "../../../../../../kibisis/kibitranslate/validators"
import { deleteMemoryEntriesWorkflow } from "../../../../../../kibisis/kibitranslate/workflows/delete-memory-entries"

export async function POST(req: MedusaRequest<DeleteMemoryInput>, res: MedusaResponse) {
  const { result } = await deleteMemoryEntriesWorkflow(req.scope).run({ input: req.validatedBody.ids })
  res.json({ deleted: result.length })
}
