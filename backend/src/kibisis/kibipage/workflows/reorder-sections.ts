import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { ReorderSectionsInput } from "../types"
import { reorderSectionsStep } from "./steps"

export const reorderSectionsWorkflow = createWorkflow(
  "reorder-sections",
  function (input: ReorderSectionsInput) {
    const sections = reorderSectionsStep(input)
    return new WorkflowResponse(sections)
  }
)
