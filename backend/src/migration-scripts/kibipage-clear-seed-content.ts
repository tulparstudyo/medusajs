import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { KIBIPAGE_MODULE } from "../kibisis/kibipage"
import KibipageModuleService from "../kibisis/kibipage/service"

const SEED_LINK_ID = /^(brand|search)-\d+$/
const SEED_BOX_ID = /^box-\d+$/
const SEED_BOX_TITLES = ["Yarın Kapında", "Tek Tıkla Güvenli", "Mobil Cebinde", "Kapında Kolay İade"]

function everyItem(items: unknown, matches: (row: Record<string, unknown>) => boolean): boolean {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) => !!item && typeof item === "object" && matches(item as Record<string, unknown>))
  )
}

function isUntouchedSeed(type: string, items: unknown): boolean {
  if (type === "fast-links") {
    return everyItem(
      items,
      (row) => typeof row.id === "string" && SEED_LINK_ID.test(row.id) && row.href === "/"
    )
  }

  return everyItem(
    items,
    (row) =>
      typeof row.id === "string" &&
      SEED_BOX_ID.test(row.id) &&
      SEED_BOX_TITLES.includes(String(row.title))
  )
}

/**
 * The home page used to be seeded with placeholder fast links and icon
 * boxes. Empties those lists unless an admin already edited them.
 */
export default async function kibipageClearSeedContent({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pages = container.resolve<KibipageModuleService>(KIBIPAGE_MODULE)
  const sections = await pages.listPageSections(
    { type: ["fast-links", "icon-box"] },
    { take: 1000 }
  )
  let cleared = 0

  for (const section of sections) {
    const settings = (section.settings ?? {}) as Record<string, unknown>

    if (!isUntouchedSeed(section.type, settings.items)) {
      continue
    }

    await pages.updatePageSections({ id: section.id, settings: { ...settings, items: [] } })
    cleared += 1
  }

  logger.info(`kibipage: ${cleared} bölümdeki varsayılan bağlantı ve ikon kutuları kaldırıldı.`)
}
