import { defineWidgetConfig } from "@medusajs/admin-sdk"

import ProductTranslateWidget from "../../kibisis/kibitranslate/admin/product-translate-widget"

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductTranslateWidget
