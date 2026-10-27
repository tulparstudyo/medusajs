import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { KIBIPAGE_MODULE } from "../kibisis/kibipage"
import KibipageModuleService from "../kibisis/kibipage/service"

const SEED_BANNER_ID = /^banner-[a-z]+$/

function isUntouchedSeed(items: unknown): boolean {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) => {
      if (!item || typeof item !== "object") {
        return false
      }
      const row = item as Record<string, unknown>
      return typeof row.id === "string" && SEED_BANNER_ID.test(row.id) && row.href === "/"
    })
  )
}

/**
 * The home page used to be seeded with placeholder promo banners. Empties
 * those lists unless an admin already edited them.
 */
export default async function kibipageClearSeedBanners({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pages = container.resolve<KibipageModuleService>(KIBIPAGE_MODULE)
  const sections = await pages.listPageSections({ type: "promo-banner" }, { take: 1000 })
  let cleared = 0

  for (const section of sections) {
    const settings = (section.settings ?? {}) as Record<string, unknown>

    if (!isUntouchedSeed(settings.items)) {
      continue
    }

    await pages.updatePageSections({ id: section.id, settings: { ...settings, items: [] } })
    cleared += 1
  }

  logger.info(`kibipage: ${cleared} bölümdeki varsayılan bannerlar kaldırıldı.`)
}
