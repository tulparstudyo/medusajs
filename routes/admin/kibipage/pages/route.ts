import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { KIBIPAGE_MODULE } from "../../../../kibisis/kibipage"
import KibipageModuleService from "../../../../kibisis/kibipage/service"
import { CreatePageInput } from "../../../../kibisis/kibipage/types"
import { createPageWorkflow } from "../../../../kibisis/kibipage/workflows/create-page"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<KibipageModuleService>(KIBIPAGE_MODULE)
  const pages = await service.listPages()

  res.json({ pages })
}

export async function POST(
  req: MedusaRequest<CreatePageInput>,
  res: MedusaResponse
) {
  const { result } = await createPageWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(201).json({ page: result })
}
