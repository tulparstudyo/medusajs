import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { KIBITRANSLATE_MODULE } from "../../../../kibisis/kibitranslate"
import KibitranslateModuleService from "../../../../kibisis/kibitranslate/service"
import { MemoryListQuerySchema } from "../../../../kibisis/kibitranslate/validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = MemoryListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Sorgu geçersiz."
    )
  }

  const service = req.scope.resolve<KibitranslateModuleService>(KIBITRANSLATE_MODULE)
  const [{ entries, count }, locales] = await Promise.all([
    service.listEntries(parsed.data),
    service.locales(),
  ])

  res.json({
    entries,
    count,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    locales,
  })
}
