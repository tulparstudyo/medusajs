import { Module } from "@medusajs/framework/utils"

import KibinavModuleService from "./service"

export const KIBINAV_MODULE = "kibinav"

export default Module(KIBINAV_MODULE, {
  service: KibinavModuleService,
})
