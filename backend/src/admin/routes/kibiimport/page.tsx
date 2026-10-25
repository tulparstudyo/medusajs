"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowDownTray } from "@medusajs/icons"

import ImportScreen from "../../../kibisis/kibiimport/admin/import-screen"

export const config = defineRouteConfig({
  label: "Ürün Aktar",
  icon: ArrowDownTray,
})

export default ImportScreen
