"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"

import MemoryScreen from "../../../../../kibisis/kibitranslate/admin/memory-screen"

export const config = defineRouteConfig({
  label: "Çeviri hafızası",
})

export default MemoryScreen
