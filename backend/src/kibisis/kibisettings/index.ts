import { Module } from "@medusajs/framework/utils"

import KibisettingsModuleService from "./service"

export const KIBISETTINGS_MODULE = "kibisettings"

export default Module(KIBISETTINGS_MODULE, {
  service: KibisettingsModuleService,
})
