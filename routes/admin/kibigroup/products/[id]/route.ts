import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

import { KIBIGROUP_MODULE } from "../../../../../kibisis/kibigroup"
import { loadAdminItems } from "../../../../../kibisis/kibigroup/lib/products"
import KibigroupModuleService from "../../../../../kibisis/kibigroup/service"
import { AdminGroupResponse } from "../../../../../kibisis/kibigroup/types"
import { AssignGroupBody } from "../../../../../kibisis/kibigroup/validators"

async function respond(req: MedusaRequest, productId: string): Promise<AdminGroupResponse> {
  const service = req.scope.resolve<KibigroupModuleService>(KIBIGROUP_MODULE)
  const group = await service.findMember(productId)
  const members = group ? await service.listMembers(group.main_code) : []

  return {
    group,
    items: await loadAdminItems(req.scope, members),
  }
}

async function assertProduct(req: MedusaRequest, productId: string): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { id: productId },
  })

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Ürün bulunamadı.")
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await respond(req, req.params.id))
}

export async function POST(req: MedusaRequest<AssignGroupBody>, res: MedusaResponse) {
  const productId = req.params.id
  await assertProduct(req, productId)

  const service = req.scope.resolve<KibigroupModuleService>(KIBIGROUP_MODULE)
  await service.assign(productId, req.validatedBody)

  res.json(await respond(req, productId))
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<KibigroupModuleService>(KIBIGROUP_MODULE)
  await service.clear(req.params.id)

  res.json(await respond(req, req.params.id))
}
