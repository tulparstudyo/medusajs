import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ContentLocale } from "../../../../kibisis/kibipage/types"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const base = process.env.KIBISIS_CONTENT_LOCALE || "tr-TR"
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [store],
  } = await query.graph({
    entity: "store",
    fields: ["supported_locales.locale_code", "supported_locales.locale.name"],
    pagination: { take: 1 },
  })

  const locales: ContentLocale[] = (store?.supported_locales ?? [])
    .filter((locale) => !!locale?.locale_code)
    .filter((locale) => locale!.locale_code.toLowerCase() !== base.toLowerCase())
    .map((locale) => ({
      code: locale!.locale_code,
      name: locale!.locale?.name ?? locale!.locale_code,
    }))

  res.json({ base, locales })
}
