"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingCart } from "@medusajs/icons"

import OrderListScreen from "../../../../kibisis/kibiorder/admin/order-list-screen"

export const config = defineRouteConfig({
  label: "Siparişler",
  icon: ShoppingCart,
})

export default OrderListScreen
