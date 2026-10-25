import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { KIBIPAGE_MODULE } from "../../../../../../kibisis/kibipage"
import KibipageModuleService from "../../../../../../kibisis/kibipage/service"
import { CreateSectionInput } from "../../../../../../kibisis/kibipage/types"
import { PageKeySchema } from "../../../../../../kibisis/kibipage/validators"
import { createSectionWorkflow } from "../../../../../../kibisis/kibipage/workflows/create-section"

function pageKeyFrom(value: string) {
  const parsed = PageKeySchema.safeParse(value)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sayfa bulunamadı.")
  }

  return parsed.data
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pageKey = pageKeyFrom(req.params.key)
  const service = req.scope.resolve<KibipageModuleService>(KIBIPAGE_MODULE)
  const sections = await service.listSections(pageKey)

  res.json({ page_key: pageKey, sections })
}

export async function POST(
  req: MedusaRequest<Omit<CreateSectionInput, "page_key">>,
  res: MedusaResponse
) {
  const pageKey = pageKeyFrom(req.params.key)
  const { result } = await createSectionWorkflow(req.scope).run({
    input: {
      page_key: pageKey,
      ...req.validatedBody,
    },
  })

  res.status(201).json({ section: result })
}
