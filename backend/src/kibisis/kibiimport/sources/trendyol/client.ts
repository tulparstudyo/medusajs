import { ImportException } from "../../errors"
import { remoteGet } from "../../remote-get"
import { ProductClient } from "../../types"
import { sharedProps } from "./parse"

export class TrendyolClient implements ProductClient {
  async fetch(url: string): Promise<Record<string, unknown>> {
    const response = await remoteGet(url, "text/html,application/xhtml+xml")

    if (response.status < 200 || response.status >= 300) {
      throw new ImportException(`Trendyol ürün linki için HTTP ${response.status} döndürdü.`)
    }

    const props = sharedProps(response.body.toString("utf8"))
    const product = props.product

    if (!product || typeof product !== "object" || Array.isArray(product) || !("id" in product) || !product.id) {
      throw new ImportException("Trendyol sayfasında ürün verisi bulunamadı.")
    }

    return {
      url,
      culture: typeof props.culture === "string" ? props.culture : "tr-TR",
      product,
    }
  }
}
