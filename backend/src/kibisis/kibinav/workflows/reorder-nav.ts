import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { ReorderNavInput } from "../types"
import { reorderNavStep } from "./steps"

export const reorderNavWorkflow = createWorkflow(
  "reorder-nav",
  function (input: ReorderNavInput) {
    const items = reorderNavStep(input)
    return new WorkflowResponse(items)
  }
)
