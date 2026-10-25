import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ReorderSectionsInput } from "../../../../kibisis/kibipage/types"
import { reorderSectionsWorkflow } from "../../../../kibisis/kibipage/workflows/reorder-sections"

export async function POST(
  req: MedusaRequest<ReorderSectionsInput>,
  res: MedusaResponse
) {
  const { result } = await reorderSectionsWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.json({ sections: result })
}
