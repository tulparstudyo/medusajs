"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"

import ImportScreen from "../../../../kibisis/kibiimport/admin/import-screen"

export const config = defineRouteConfig({
  label: "Ürün Aktar",
})

export default ImportScreen
