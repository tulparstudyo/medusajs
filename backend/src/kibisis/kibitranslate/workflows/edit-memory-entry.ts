import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import { editMemoryEntryStep } from "./steps"

export const editMemoryEntryWorkflow = createWorkflow(
  "edit-memory-entry",
  function (input: { id: string; translated_text: string }) {
    const entry = editMemoryEntryStep(input)
    return new WorkflowResponse(entry)
  }
)
