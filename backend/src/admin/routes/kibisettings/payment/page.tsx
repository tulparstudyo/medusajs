"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"

import PaymentForm from "../../../../kibisis/kibisettings/admin/forms/payment-form"
import SettingsScreen from "../../../../kibisis/kibisettings/admin/settings-screen"

export const config = defineRouteConfig({
  label: "Ödeme Ayarları",
})

const PaymentSettingsPage = () => (
  <SettingsScreen settingsKey="payment" render={(props) => <PaymentForm {...props} />} />
)

export default PaymentSettingsPage
