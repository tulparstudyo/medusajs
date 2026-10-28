import type { MedusaContainer } from "@medusajs/framework/types"

import { runQueue } from "../kibisis/kibijson/runner"

/** Picks up queued JSON import items, retries that came due and runs left behind by a restart. */
export default async function kibijsonRunner(container: MedusaContainer) {
  await runQueue(container)
}

export const config = {
  name: "kibijson-runner",
  schedule: "* * * * *",
}
