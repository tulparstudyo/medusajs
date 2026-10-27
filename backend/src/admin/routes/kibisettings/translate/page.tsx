"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"

import SettingsScreen from "../../../../kibisis/kibisettings/admin/settings-screen"
import TranslateForm from "../../../../kibisis/kibisettings/admin/forms/translate-form"

export const config = defineRouteConfig({
  label: "AI Çeviri",
})

const TranslateSettingsPage = () => (
  <SettingsScreen settingsKey="translate" render={(props) => <TranslateForm {...props} />} />
)

export default TranslateSettingsPage
