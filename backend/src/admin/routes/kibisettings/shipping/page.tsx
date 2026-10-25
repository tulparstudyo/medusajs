"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"

import ShippingForm from "../../../../kibisis/kibisettings/admin/forms/shipping-form"
import SettingsScreen from "../../../../kibisis/kibisettings/admin/settings-screen"

export const config = defineRouteConfig({
  label: "Kargo Gönderi Ayarları",
})

const ShippingSettingsPage = () => (
  <SettingsScreen settingsKey="shipping" render={(props) => <ShippingForm {...props} />} />
)

export default ShippingSettingsPage
