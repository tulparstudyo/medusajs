import { defineWidgetConfig } from "@medusajs/admin-sdk"

import BulkTranslateWidget from "../../kibisis/kibitranslate/admin/bulk-translate-widget"
import { PRODUCT_OPTIONS_BULK_TRANSLATE } from "../../kibisis/kibitranslate/admin/bulk-translate-configs"

const ProductOptionsTranslateWidget = () => (
  <BulkTranslateWidget config={PRODUCT_OPTIONS_BULK_TRANSLATE} />
)

export const config = defineWidgetConfig({
  zone: "product_option.list.before",
})

export default ProductOptionsTranslateWidget
