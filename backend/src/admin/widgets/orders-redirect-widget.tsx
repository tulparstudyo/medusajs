import { defineWidgetConfig } from "@medusajs/admin-sdk"
import OrdersRedirectWidget from "../../kibisis/kibiorder/admin/orders-redirect-widget"

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default OrdersRedirectWidget

