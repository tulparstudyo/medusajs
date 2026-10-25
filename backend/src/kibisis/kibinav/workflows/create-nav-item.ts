import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { CreateNavItemInput } from "../types"
import { createNavItemStep } from "./steps"

export const createNavItemWorkflow = createWorkflow(
  "create-nav-item",
  function (input: CreateNavItemInput) {
    const item = createNavItemStep(input)
    return new WorkflowResponse(item)
  }
)
