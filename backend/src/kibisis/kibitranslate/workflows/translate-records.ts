import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { translateRecords, TranslateRecordsRequest } from "../translator"

/**
 * Machine-translates content records inside a workflow, e.g. product titles
 * before they are saved with the Translation Module. It only reads, so there
 * is nothing to compensate.
 */
export const translateRecordsStep = createStep(
  "translate-records",
  async (input: TranslateRecordsRequest, { container }) => {
    return new StepResponse(await translateRecords(container, input))
  }
)
