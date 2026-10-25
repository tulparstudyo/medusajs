"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"

import CarriersForm from "../../../../kibisis/kibisettings/admin/forms/carriers-form"
import SettingsScreen from "../../../../kibisis/kibisettings/admin/settings-screen"

export const config = defineRouteConfig({
  label: "Kargo Firmaları",
})

const CarriersSettingsPage = () => (
  <SettingsScreen settingsKey="carriers" render={(props) => <CarriersForm {...props} />} />
)

export default CarriersSettingsPage
