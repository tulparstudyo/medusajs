import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { KibipaymentProviderService } from "./provider"

export const KIBIPAYMENT_MODULE = "kibipayment"

export default ModuleProvider(Modules.PAYMENT, {
  services: [KibipaymentProviderService],
})

