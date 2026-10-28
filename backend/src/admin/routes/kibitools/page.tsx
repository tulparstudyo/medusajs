"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tools } from "@medusajs/icons"

import { ToolsMenuList } from "../../../kibisis/kibitools/admin/tools-menu"

export const config = defineRouteConfig({
  label: "Kibitools",
  icon: Tools,
})

export default ToolsMenuList
