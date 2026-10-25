import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { installCarrier } from "../../../../kibisis/kibicarrier/installer"
import { InstallCarrierInput } from "../../../../kibisis/kibicarrier/validators"

export async function POST(req: MedusaRequest<InstallCarrierInput>, res: MedusaResponse) {
  const installation = await installCarrier(req.validatedBody.repo)

  res.status(201).json({ installation })
}
