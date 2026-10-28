import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { KIBIPAGE_MODULE } from "../../../../../../kibisis/kibipage"
import { uploadSectionFile } from "../../../../../../kibisis/kibipage/lib/section-files"
import KibipageModuleService from "../../../../../../kibisis/kibipage/service"

type UploadBody = {
  filename: string
  mime_type: string
  content: string
}

export async function POST(
  req: MedusaRequest<UploadBody>,
  res: MedusaResponse
) {
  const service = req.scope.resolve<KibipageModuleService>(KIBIPAGE_MODULE)
  const section = await service.getSection(req.params.id)
  const body = req.validatedBody

  const file = await uploadSectionFile(req.scope, section.id, {
    filename: body.filename,
    mimeType: body.mime_type,
    content: body.content,
  })

  res.status(201).json({ file })
}
