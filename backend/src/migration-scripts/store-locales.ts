import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"

const LOCALES = ["tr-TR", "en-US"]

export default async function storeLocales({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [store],
  } = await query.graph({
    entity: "store",
    fields: ["id", "supported_locales.locale_code"],
    pagination: { take: 1 },
  })

  if (!store) {
    logger.warn("store-locales: mağaza bulunamadı, diller eklenmedi.")
    return
  }

  if (store.supported_locales?.length) {
    return
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_locales: LOCALES.map((locale_code) => ({ locale_code })),
      },
    },
  })

  logger.info(`store-locales: ${LOCALES.join(", ")} mağaza dillerine eklendi.`)
}
