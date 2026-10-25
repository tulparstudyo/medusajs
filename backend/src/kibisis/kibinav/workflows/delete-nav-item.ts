import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { deleteNavItemStep } from "./steps"

export const deleteNavItemWorkflow = createWorkflow(
  "delete-nav-item",
  function (id: string) {
    const result = deleteNavItemStep(id)
    return new WorkflowResponse(result)
  }
)
