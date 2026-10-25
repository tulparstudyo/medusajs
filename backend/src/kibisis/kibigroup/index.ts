import { Module } from "@medusajs/framework/utils"

import KibigroupModuleService from "./service"

export const KIBIGROUP_MODULE = "kibigroup"

export default Module(KIBIGROUP_MODULE, {
  service: KibigroupModuleService,
})
