import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"

import {
  ListingResult,
  parseListingQuery,
  runListingQuery,
} from "../../../kibisis/kibilisting/query"

export async function GET(req: MedusaStoreRequest, res: MedusaResponse<ListingResult>) {
  const query = parseListingQuery(
    req.query as Record<string, unknown>,
    req.publishable_key_context?.sales_channel_ids ?? []
  )

  res.json(await runListingQuery(req.scope, query))
}
