import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"

const LOCALE = "ru-RU"

export default async function storeLocaleRu({ container }: ExecArgs) {
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
    logger.warn("store-locale-ru: mağaza bulunamadı, dil eklenmedi.")
    return
  }

  const current = (store.supported_locales ?? [])
    .map((locale) => locale?.locale_code)
    .filter((code): code is string => !!code)
  if (current.includes(LOCALE)) {
    return
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_locales: [...current, LOCALE].map((locale_code) => ({ locale_code })),
      },
    },
  })

  logger.info(`store-locale-ru: ${LOCALE} mağaza dillerine eklendi.`)
}
