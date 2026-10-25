"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"

import StoreForm from "../../../../kibisis/kibisettings/admin/forms/store-form"
import SettingsScreen from "../../../../kibisis/kibisettings/admin/settings-screen"

export const config = defineRouteConfig({
  label: "Mağaza Ayarları",
})

const StoreSettingsPage = () => (
  <SettingsScreen settingsKey="store" render={(props) => <StoreForm {...props} />} />
)

export default StoreSettingsPage
