import { defineWidgetConfig } from "@medusajs/admin-sdk"

import BulkTranslateWidget from "../../kibisis/kibitranslate/admin/bulk-translate-widget"
import { CATEGORIES_BULK_TRANSLATE } from "../../kibisis/kibitranslate/admin/bulk-translate-configs"

const CategoriesTranslateWidget = () => <BulkTranslateWidget config={CATEGORIES_BULK_TRANSLATE} />

export const config = defineWidgetConfig({
  zone: "product_category.list.before",
})

export default CategoriesTranslateWidget
