import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { deletePageStep } from "./steps"

export const deletePageWorkflow = createWorkflow(
  "delete-page",
  function (id: string) {
    const result = deletePageStep(id)
    return new WorkflowResponse(result)
  }
)

