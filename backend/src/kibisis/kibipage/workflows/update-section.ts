import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { UpdateSectionInput } from "../types"
import { updateSectionStep } from "./steps"

export const updateSectionWorkflow = createWorkflow(
  "update-section",
  function (input: { id: string; data: UpdateSectionInput }) {
    const section = updateSectionStep(input)
    return new WorkflowResponse(section)
  }
)
