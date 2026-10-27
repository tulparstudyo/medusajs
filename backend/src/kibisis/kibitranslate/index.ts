import { Module } from "@medusajs/framework/utils"

import KibitranslateModuleService from "./service"

export const KIBITRANSLATE_MODULE = "kibitranslate"

export default Module(KIBITRANSLATE_MODULE, {
  service: KibitranslateModuleService,
})
