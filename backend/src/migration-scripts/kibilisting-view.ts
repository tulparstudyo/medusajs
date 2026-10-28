import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { createListingView, LISTING_VIEW } from "../kibisis/kibilisting/view"

export default async function kibilistingView({ container }: ExecArgs) {
  await createListingView(container)

  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`kibilisting: ${LISTING_VIEW} görünümü oluşturuldu.`)
}
