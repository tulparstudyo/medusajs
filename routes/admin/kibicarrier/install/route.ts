import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { installCarrier } from "../../../../kibisis/kibicarrier/installer"
import { rememberRequestOrigin } from "../../../../kibisis/kibicarrier/license-server"
import { InstallCarrierInput } from "../../../../kibisis/kibicarrier/validators"

export async function POST(req: MedusaRequest<InstallCarrierInput>, res: MedusaResponse) {
  rememberRequestOrigin(req)
  const installation = await installCarrier(req.validatedBody.repo)

  res.status(201).json({ installation })
}
