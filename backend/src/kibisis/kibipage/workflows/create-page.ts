import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { CreatePageInput } from "../types"
import { createPageStep } from "./steps"

export const createPageWorkflow = createWorkflow(
  "create-page",
  function (input: CreatePageInput) {
    const page = createPageStep(input)
    return new WorkflowResponse(page)
  }
)

