import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { deleteSectionStep } from "./steps"

export const deleteSectionWorkflow = createWorkflow(
  "delete-section",
  function (id: string) {
    const result = deleteSectionStep(id)
    return new WorkflowResponse(result)
  }
)
