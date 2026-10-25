import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { KIBINAV_MODULE } from "../../../../kibisis/kibinav"
import KibinavModuleService from "../../../../kibisis/kibinav/service"
import { CreateNavItemInput, NavMenu } from "../../../../kibisis/kibinav/types"
import { MenuParamSchema } from "../../../../kibisis/kibinav/validators"
import { createNavItemWorkflow } from "../../../../kibisis/kibinav/workflows/create-nav-item"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = MenuParamSchema.safeParse(req.query.menu)
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Geçersiz menü."
    )
  }

  const service = req.scope.resolve<KibinavModuleService>(KIBINAV_MODULE)
  const items = await service.listMenu(parsed.data as NavMenu)

  res.json({ items })
}

export async function POST(
  req: MedusaRequest<CreateNavItemInput>,
  res: MedusaResponse
) {
  const { result } = await createNavItemWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(201).json({ item: result })
}
