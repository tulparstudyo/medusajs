import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { KIBIGROUP_MODULE } from "../../../../kibisis/kibigroup"
import KibigroupModuleService from "../../../../kibisis/kibigroup/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const term = typeof req.query.q === "string" ? req.query.q : ""
  const service = req.scope.resolve<KibigroupModuleService>(KIBIGROUP_MODULE)

  res.json({ codes: await service.searchCodes(term.slice(0, 80)) })
}
