import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { CHALLENGE_ID_PATTERN, takeChallenge } from "../../../../kibisis/kibicarrier/challenge"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const challenge = CHALLENGE_ID_PATTERN.test(req.params.id) ? takeChallenge(req.params.id) : null

  if (!challenge) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Challenge bulunamadı.")
  }

  res.json(challenge)
}
