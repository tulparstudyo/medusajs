import { defineWidgetConfig } from "@medusajs/admin-sdk"

import GroupWidget from "../../kibisis/kibigroup/admin/group-widget"

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default GroupWidget
