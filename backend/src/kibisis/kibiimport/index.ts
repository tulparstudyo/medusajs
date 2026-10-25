import { Module } from "@medusajs/framework/utils"

import KibiimportModuleService from "./service"

export const KIBIIMPORT_MODULE = "kibiimport"

export default Module(KIBIIMPORT_MODULE, {
  service: KibiimportModuleService,
})
