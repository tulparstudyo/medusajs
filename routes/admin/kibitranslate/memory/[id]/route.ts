import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { EditMemoryInput } from "../../../../../kibisis/kibitranslate/validators"
import { deleteMemoryEntriesWorkflow } from "../../../../../kibisis/kibitranslate/workflows/delete-memory-entries"
import { editMemoryEntryWorkflow } from "../../../../../kibisis/kibitranslate/workflows/edit-memory-entry"

export async function POST(req: MedusaRequest<EditMemoryInput>, res: MedusaResponse) {
  const { result } = await editMemoryEntryWorkflow(req.scope).run({
    input: { id: req.params.id, translated_text: req.validatedBody.translated_text },
  })
  res.json({ entry: result })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await deleteMemoryEntriesWorkflow(req.scope).run({ input: [req.params.id] })
  if (!result.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Çeviri kaydı bulunamadı.")
  }
  res.json({ id: req.params.id, deleted: true })
}
