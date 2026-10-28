import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const LISTING_VIEW = "kibi_listing_rows"

/**
 * One row per listable product × category × sales channel × variant × option
 * value × base price currency. Only published products in active, public
 * categories whose variant has a base price (no price list, no rules) are
 * included, so a product without a price in a currency never lists in it.
 *
 * Reads Medusa's own product and pricing tables: recheck the joins after a
 * Medusa upgrade that changes their schema.
 */
const VIEW_SQL = `
  CREATE VIEW ${LISTING_VIEW} AS
  SELECT
    p.id AS product_id,
    p.title,
    p.subtitle,
    p.description,
    p.collection_id,
    p.created_at,
    pcp.product_category_id AS category_id,
    psc.sales_channel_id,
    pv.id AS variant_id,
    po.title AS option_title,
    pov.value AS option_value,
    pov.rank AS option_rank,
    pr.currency_code,
    pr.amount AS price_amount
  FROM product p
  JOIN product_category_product pcp ON pcp.product_id = p.id
  JOIN product_category pc
    ON pc.id = pcp.product_category_id
   AND pc.deleted_at IS NULL
   AND pc.is_active
   AND NOT pc.is_internal
  JOIN product_sales_channel psc
    ON psc.product_id = p.id
   AND psc.deleted_at IS NULL
  JOIN product_variant pv
    ON pv.product_id = p.id
   AND pv.deleted_at IS NULL
  JOIN product_variant_price_set vps
    ON vps.variant_id = pv.id
   AND vps.deleted_at IS NULL
  JOIN price pr
    ON pr.price_set_id = vps.price_set_id
   AND pr.deleted_at IS NULL
   AND pr.price_list_id IS NULL
   AND pr.rules_count = 0
  LEFT JOIN product_variant_option pvo ON pvo.variant_id = pv.id
  LEFT JOIN product_option_value pov
    ON pov.id = pvo.option_value_id
   AND pov.deleted_at IS NULL
  LEFT JOIN product_option po
    ON po.id = pov.option_id
   AND po.deleted_at IS NULL
  WHERE p.deleted_at IS NULL
    AND p.status = 'published'
`

type Database = {
  raw: (sql: string) => Promise<unknown>
}

/** Drops and recreates the view, so column changes apply cleanly. */
export async function createListingView(container: MedusaContainer) {
  const database = container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  ) as Database

  await database.raw(`DROP VIEW IF EXISTS ${LISTING_VIEW}`)
  await database.raw(VIEW_SQL)
}
