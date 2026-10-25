"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ListTree } from "@medusajs/icons"

import NavPage from "../../../kibisis/kibinav/admin/nav-page"

export const config = defineRouteConfig({
  label: "Navigasyon",
  icon: ListTree,
})

export default NavPage
