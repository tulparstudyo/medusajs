import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"

import { KIBIGROUP_MODULE } from "../../../../kibisis/kibigroup"
import { loadStoreItems } from "../../../../kibisis/kibigroup/lib/products"
import KibigroupModuleService from "../../../../kibisis/kibigroup/service"
import { StoreGroupResponse } from "../../../../kibisis/kibigroup/types"

export async function GET(req: MedusaStoreRequest, res: MedusaResponse<StoreGroupResponse>) {
  const service = req.scope.resolve<KibigroupModuleService>(KIBIGROUP_MODULE)
  const group = await service.findMember(req.params.id)

  if (!group) {
    res.json({ main_code: null, items: [] })
    return
  }

  const members = await service.listMembers(group.main_code)
  const items = await loadStoreItems(
    req.scope,
    members,
    req.publishable_key_context?.sales_channel_ids ?? []
  )

  res.json({ main_code: group.main_code, items })
}
