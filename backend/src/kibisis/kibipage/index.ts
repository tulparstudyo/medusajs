import { Module } from "@medusajs/framework/utils"

import KibipageModuleService from "./service"

export const KIBIPAGE_MODULE = "kibipage"

export default Module(KIBIPAGE_MODULE, {
  service: KibipageModuleService,
})
