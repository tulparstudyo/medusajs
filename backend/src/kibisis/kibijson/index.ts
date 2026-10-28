import { Module } from "@medusajs/framework/utils"

import KibijsonModuleService from "./service"

export const KIBIJSON_MODULE = "kibijson"

export default Module(KIBIJSON_MODULE, {
  service: KibijsonModuleService,
})
