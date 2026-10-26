"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"

import SocialForm from "../../../../kibisis/kibisettings/admin/forms/social-form"
import SettingsScreen from "../../../../kibisis/kibisettings/admin/settings-screen"

export const config = defineRouteConfig({
  label: "Sosyal Medya",
})

const SocialSettingsPage = () => (
  <SettingsScreen settingsKey="social" render={(props) => <SocialForm {...props} />} />
)

export default SocialSettingsPage
