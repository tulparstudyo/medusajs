import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { UpdatePageInput } from "../types"
import { updatePageStep } from "./steps"

export const updatePageWorkflow = createWorkflow(
  "update-page",
  function (input: { id: string; data: UpdatePageInput }) {
    const page = updatePageStep(input)
    return new WorkflowResponse(page)
  }
)

