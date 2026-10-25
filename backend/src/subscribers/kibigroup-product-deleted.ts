import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { KIBIGROUP_MODULE } from "../kibisis/kibigroup"
import KibigroupModuleService from "../kibisis/kibigroup/service"

export default async function kibigroupProductDeleted({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await container.resolve<KibigroupModuleService>(KIBIGROUP_MODULE).clear(data.id)
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
