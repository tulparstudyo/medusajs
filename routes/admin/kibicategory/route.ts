import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { importCategories } from "../../../kibisis/kibicategory/importer"
import { ImportCategoriesBody } from "../../../kibisis/kibicategory/validators"
import { listCategories } from "../../../kibisis/kibiimport/queue"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ categories: await listCategories(req.scope) })
}

export async function POST(req: MedusaRequest<ImportCategoriesBody>, res: MedusaResponse) {
  const result = await importCategories(req.scope, req.validatedBody)

  res.status(result.dry_run ? 200 : 201).json(result)
}
