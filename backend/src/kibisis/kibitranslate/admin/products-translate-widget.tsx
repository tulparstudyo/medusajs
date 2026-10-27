import BulkTranslateWidget from "./bulk-translate-widget"
import { PRODUCTS_BULK_TRANSLATE } from "./bulk-translate-configs"

export default function ProductsTranslateWidget() {
  return <BulkTranslateWidget config={PRODUCTS_BULK_TRANSLATE} />
}
