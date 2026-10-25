import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listImportPage, queueAndDrain } from "../../../kibisis/kibiimport/queue"
import { ImportProductsInput } from "../../../kibisis/kibiimport/validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const page = await listImportPage(req.scope)

  res.json(page)
}

export async function POST(
  req: MedusaRequest<ImportProductsInput>,
  res: MedusaResponse
) {
  const result = await queueAndDrain(req.scope, req.validatedBody)

  res.status(201).json(result)
}
