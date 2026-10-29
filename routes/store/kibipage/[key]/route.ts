import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { KIBIPAGE_MODULE } from "../../../../kibisis/kibipage"
import KibipageModuleService from "../../../../kibisis/kibipage/service"
import { PageKeySchema } from "../../../../kibisis/kibipage/validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = PageKeySchema.safeParse(req.params.key)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sayfa bulunamadı.")
  }

  const service = req.scope.resolve<KibipageModuleService>(KIBIPAGE_MODULE)
  const page = await service.getPublicPage(parsed.data, req.locale)

  res.json(page)
}
