import { defineWidgetConfig } from "@medusajs/admin-sdk"

import ProductsCategoryFilterWidget from "../../kibisis/kibicategory/admin/products-category-filter-widget"

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default ProductsCategoryFilterWidget

