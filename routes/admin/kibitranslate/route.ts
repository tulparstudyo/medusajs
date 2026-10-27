import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { translateStatus, translateTexts } from "../../../kibisis/kibitranslate/translator"
import { TranslateTextsInput } from "../../../kibisis/kibitranslate/validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ status: await translateStatus(req.scope) })
}

export async function POST(req: MedusaRequest<TranslateTextsInput>, res: MedusaResponse) {
  const texts = await translateTexts(req.scope, req.validatedBody)
  res.json({ texts })
}
