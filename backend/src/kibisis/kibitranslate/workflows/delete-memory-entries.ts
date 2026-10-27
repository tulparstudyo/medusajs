import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import { deleteMemoryEntriesStep } from "./steps"

export const deleteMemoryEntriesWorkflow = createWorkflow(
  "delete-memory-entries",
  function (ids: string[]) {
    const deleted = deleteMemoryEntriesStep(ids)
    return new WorkflowResponse(deleted)
  }
)
