import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { rebuildHandles } from "../../../../kibisis/kibicategory/importer"
import { RebuildHandlesBody } from "../../../../kibisis/kibicategory/validators"

export async function POST(req: MedusaRequest<RebuildHandlesBody>, res: MedusaResponse) {
  res.json(await rebuildHandles(req.scope, req.validatedBody))
}
