import { defineWidgetConfig } from "@medusajs/admin-sdk"

import ProductsTranslateWidget from "../../kibisis/kibitranslate/admin/products-translate-widget"

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default ProductsTranslateWidget
