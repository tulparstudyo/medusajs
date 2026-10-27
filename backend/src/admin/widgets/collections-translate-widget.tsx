import { defineWidgetConfig } from "@medusajs/admin-sdk"

import BulkTranslateWidget from "../../kibisis/kibitranslate/admin/bulk-translate-widget"
import { COLLECTIONS_BULK_TRANSLATE } from "../../kibisis/kibitranslate/admin/bulk-translate-configs"

const CollectionsTranslateWidget = () => <BulkTranslateWidget config={COLLECTIONS_BULK_TRANSLATE} />

export const config = defineWidgetConfig({
  zone: "product_collection.list.before",
})

export default CollectionsTranslateWidget
