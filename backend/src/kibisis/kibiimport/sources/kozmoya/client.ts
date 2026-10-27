import { HttpStatusException, ImportException } from "../../errors"
import { hostMatches } from "../../lib/urls"
import { remoteGet } from "../../remote-get"
import { ProductClient } from "../../types"
import {
  galleryImages,
  mainSection,
  metaContent,
  oldPrice,
  optionGroups,
  productId,
  productLd,
  productLink,
  siblings,
  Siblings,
  stockText,
  stripTags,
  variantSku,
} from "./parse"

/** The shop receives at most one page request per second. */
const PAGE_GAP_MS = 1_000
const MAX_SIZES = 20

type Page = Record<string, unknown> & { productId: string }

/**
 * KozmoyaClient reads an OpenCart product page of kozmoya.com. The page has no
 * product API, so the payload is collected from the structured data block and
 * the product form. Every size of a product is a separate OpenCart product
 * linked from the size selector; those pages are read too so the sizes can
 * become variants of one product.
 */
export class KozmoyaClient implements ProductClient {
  async fetch(url: string): Promise<Record<string, unknown>> {
    const first = await readPage(productLink(url))
    const sizes = first.siblings

    const requestedId = first.page.productId
    const requestedSku = variantSku(url)

    if (!sizes) {
      return { url, requestedId, requestedSku, sizeName: null, pages: [{ ...first.page, size: null }] }
    }

    const pages: Page[] = []
    const seen = new Set<string>()

    for (const link of sizes.links.slice(0, MAX_SIZES)) {
      let page: Page

      if (link.selected) {
        page = first.page
      } else if (isShopLink(link.url)) {
        await new Promise((resolve) => setTimeout(resolve, PAGE_GAP_MS))
        page = (await readPage(productLink(link.url))).page
      } else {
        continue
      }

      if (!seen.has(page.productId)) {
        seen.add(page.productId)
        pages.push({ ...page, size: link.label })
      }
    }

    if (!seen.has(requestedId)) {
      pages.unshift({ ...first.page, size: null })
    }

    return { url, requestedId, requestedSku, sizeName: sizes.name, pages }
  }
}

async function readPage(url: string): Promise<{ page: Page; siblings: Siblings | null }> {
  const response = await remoteGet(url, "text/html,application/xhtml+xml")

  if (response.status < 200 || response.status >= 300) {
    throw new HttpStatusException(response.status, `Kozmoya ${url} için HTTP ${response.status} döndürdü.`)
  }

  const html = response.body.toString("utf8")
  const id = productId(html)
  const ld = productLd(html)

  if (html.includes("_cf_chl_opt") && (!id || !ld)) {
    throw new HttpStatusException(403, "Kozmoya isteği Cloudflare doğrulamasına takıldı.")
  }

  if (!id || !ld) {
    throw new ImportException(`Kozmoya sayfasında ürün verisi bulunamadı: ${url}`)
  }

  const section = mainSection(html)
  const title = section.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)

  return {
    page: {
      url,
      productId: id,
      title: title ? stripTags(title[1] ?? "") : "",
      ld,
      currency: metaContent(html, "product:price:currency"),
      price: metaContent(html, "product:price:amount"),
      oldPrice: oldPrice(section),
      stock: stockText(section),
      images: galleryImages(html, url),
      options: optionGroups(section),
    },
    siblings: siblings(section, url),
  }
}

function isShopLink(url: string): boolean {
  try {
    const address = new URL(url)
    return address.protocol === "https:" && hostMatches(address.hostname, "kozmoya.com")
  } catch {
    return false
  }
}
