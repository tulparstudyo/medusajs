"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"

import SettingsScreen from "../../../../kibisis/kibisettings/admin/settings-screen"
import SmtpForm from "../../../../kibisis/kibisettings/admin/forms/smtp-form"

export const config = defineRouteConfig({
  label: "SMTP Ayarları",
})

const SmtpSettingsPage = () => (
  <SettingsScreen settingsKey="smtp" render={(props) => <SmtpForm {...props} />} />
)

export default SmtpSettingsPage
