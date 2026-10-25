"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CogSixTooth } from "@medusajs/icons"

import { SettingsMenuList } from "../../../kibisis/kibisettings/admin/settings-menu"

export const config = defineRouteConfig({
  label: "Site Ayarları",
  icon: CogSixTooth,
})

export default SettingsMenuList
