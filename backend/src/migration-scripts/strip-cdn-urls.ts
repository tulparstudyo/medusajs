import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { stripCdnUrl, transformSectionSettingsCdn } from "../kibisis/cdn/url"
import { KIBIPAGE_MODULE } from "../kibisis/kibipage"
import KibipageModuleService from "../kibisis/kibipage/service"

type Database = {
  raw: (
    sql: string,
    bindings?: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>
}

const IMAGE_COLUMNS: { table: string; column: string }[] = [
  { table: "product", column: "thumbnail" },
  { table: "product_image", column: "url" },
  { table: "product_variant", column: "thumbnail" },
  { table: "cart_line_item", column: "thumbnail" },
  { table: "order_line_item", column: "thumbnail" },
]

async function hasColumn(
  database: Database,
  table: string,
  column: string
): Promise<boolean> {
  const { rows } = await database.raw(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [table, column]
  )
  return rows.length > 0
}

async function stripColumnUrls(
  database: Database,
  table: string,
  column: string
): Promise<number> {
  if (!(await hasColumn(database, table, column))) {
    return 0
  }

  const { rows } = await database.raw(
    `SELECT id, ${column} AS value FROM "${table}" WHERE ${column} IS NOT NULL AND ${column} LIKE 'http%'`
  )

  let updated = 0
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : ""
    const current = typeof row.value === "string" ? row.value : ""
    if (!id || !current) {
      continue
    }

    const next = stripCdnUrl(current)
    if (next !== current) {
      await database.raw(
        `UPDATE "${table}" SET ${column} = ? WHERE id = ?`,
        [next, id]
      )
      updated += 1
    }
  }

  return updated
}

async function stripSectionUrls(pages: KibipageModuleService): Promise<number> {
  const sections = await pages.listPageSections({}, { take: 5000 })
  let updated = 0

  for (const section of sections) {
    if (!section.settings || typeof section.settings !== "object") {
      continue
    }

    const next = transformSectionSettingsCdn(
      section.settings as Record<string, unknown>,
      "strip"
    )
    if (JSON.stringify(next) !== JSON.stringify(section.settings)) {
      await pages.updatePageSections({ id: section.id, settings: next })
      updated += 1
    }
  }

  return updated
}

export default async function stripCdnUrlsMigration({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const database = container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  ) as Database
  const pages = container.resolve<KibipageModuleService>(KIBIPAGE_MODULE)

  let totalColumns = 0
  for (const { table, column } of IMAGE_COLUMNS) {
    totalColumns += await stripColumnUrls(database, table, column)
  }

  const sectionCount = await stripSectionUrls(pages)

  logger.info(
    `cdn: ${totalColumns} görsel kaydı ve ${sectionCount} sayfa bölümü CDN adresinden arındırıldı.`
  )
}

