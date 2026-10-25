"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText } from "@medusajs/icons"

import PagesScreen from "../../../kibisis/kibipage/admin/pages-screen"

export const config = defineRouteConfig({
  label: "Sayfalar",
  icon: DocumentText,
})

export default PagesScreen
