import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { KIBIGROUP_MODULE } from "../kibisis/kibigroup"
import KibigroupModuleService from "../kibisis/kibigroup/service"
import { KIBIIMPORT_MODULE } from "../kibisis/kibiimport"
import KibiimportModuleService from "../kibisis/kibiimport/service"

const PAGE = 500

export default async function kibigroupBackfill({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const imports = container.resolve<KibiimportModuleService>(KIBIIMPORT_MODULE)
  const groups = container.resolve<KibigroupModuleService>(KIBIGROUP_MODULE)
  let skip = 0
  let added = 0

  for (;;) {
    const links = await imports.listImportProducts(
      {},
      { take: PAGE, skip, order: { created_at: "ASC" } }
    )

    for (const link of links) {
      if (await groups.findMember(link.product_id)) {
        continue
      }

      await groups.rememberImported(link.product_id, link.code, link.color)
      added += 1
    }

    if (links.length < PAGE) {
      break
    }

    skip += PAGE
  }

  logger.info(`kibigroup: ${added} aktarılmış ürün renk grubuna eklendi.`)
}
