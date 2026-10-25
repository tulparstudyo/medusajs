import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

import { KIBINAV_MODULE } from "../../../../kibisis/kibinav"
import { toPublicTree } from "../../../../kibisis/kibinav/lib/public-tree"
import KibinavModuleService from "../../../../kibisis/kibinav/service"
import { MenuParamSchema } from "../../../../kibisis/kibinav/validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = MenuParamSchema.safeParse(req.params.menu)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Menü bulunamadı.")
  }

  const service = req.scope.resolve<KibinavModuleService>(KIBINAV_MODULE)
  const items = await service.listMenu(parsed.data)
  const categoryIds = [
    ...new Set(
      items
        .map((item) => item.category_id)
        .filter((id): id is string => !!id)
    ),
  ]

  const handles = new Map<string, string>()
  if (categoryIds.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product_category",
      fields: ["id", "handle"],
      filters: { id: categoryIds },
    })

    for (const category of data) {
      if (category.id && category.handle) {
        handles.set(category.id, category.handle)
      }
    }
  }

  res.json({
    menu: parsed.data,
    items: toPublicTree(items, handles),
  })
}
