import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { pruneBatches } from "../kibisis/kibijson/actions"
import { pruneProcessed } from "../kibisis/kibijson/local-images"

const DAY_MS = 24 * 60 * 60 * 1000
const BATCH_DAYS = 30
const FOLDER_DAYS = 7

/** Drops finished JSON import batches after a month and archived image folders after a week. */
export default async function kibijsonPrune(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const batches = await pruneBatches(container, BATCH_DAYS * DAY_MS)
  const folders = await pruneProcessed(FOLDER_DAYS * DAY_MS)

  if (batches || folders) {
    logger.info(`kibijson: ${batches} eski parti ve ${folders} arşiv görsel klasörü silindi.`)
  }
}

export const config = {
  name: "kibijson-prune",
  schedule: "30 3 * * *",
}
