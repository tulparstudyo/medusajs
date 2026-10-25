import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { KIBIPAGE_MODULE } from "../../../../kibisis/kibipage"
import KibipageModuleService from "../../../../kibisis/kibipage/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<KibipageModuleService>(KIBIPAGE_MODULE)
  const pages = await service.listPages()

  res.json({ pages })
}
