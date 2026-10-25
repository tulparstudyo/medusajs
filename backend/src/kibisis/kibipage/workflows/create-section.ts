import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { CreateSectionInput } from "../types"
import { createSectionStep } from "./steps"

export const createSectionWorkflow = createWorkflow(
  "create-section",
  function (input: CreateSectionInput) {
    const section = createSectionStep(input)
    return new WorkflowResponse(section)
  }
)
