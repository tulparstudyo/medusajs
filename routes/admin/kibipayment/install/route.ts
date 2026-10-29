import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { installPaymentProvider } from "../../../../kibisis/kibipayment/installer"
import { rememberRequestOrigin } from "../../../../kibisis/kibicarrier/license-server"
import { InstallPaymentInput } from "../../../../kibisis/kibipayment/validators"

export async function POST(req: MedusaRequest<InstallPaymentInput>, res: MedusaResponse) {
  rememberRequestOrigin(req)
  const installation = await installPaymentProvider(req.validatedBody.repo)

  res.status(201).json({ installation })
}

