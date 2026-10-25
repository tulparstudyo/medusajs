import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { UpdateNavItemInput } from "../types"
import { updateNavItemStep } from "./steps"

export const updateNavItemWorkflow = createWorkflow(
  "update-nav-item",
  function (input: { id: string; data: UpdateNavItemInput }) {
    const item = updateNavItemStep(input)
    return new WorkflowResponse(item)
  }
)
