import type { MedusaContainer } from "@medusajs/framework/types"

import { IMPORT_STOCK, writeProduct } from "./catalog"
import { ImportException } from "./errors"
import { KIBIIMPORT_MODULE } from "./index"
import { SourceRegistry } from "./registry"
import KibiimportModuleService from "./service"
import { ImportedProduct, ImportedVariant, ImportResult, StockResult } from "./types"

export async function readProduct(url: string): Promise<ImportedProduct> {
  const source = new SourceRegistry().match(url)
  const payload = await source.client.fetch(url)
  const product = source.adapter.adapt(url, payload)
  assertProduct(product)

  return product
}

export async function importProduct(
  container: MedusaContainer,
  url: string,
  categoryId: string,
  locationIds: string[] = [],
  currencyCode: string | null = null
): Promise<ImportResult> {
  const product = await readProduct(url)
  const service = container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService

  return await writeProduct(container, service, product, categoryId, locationIds, currencyCode)
}

export function renderResult(result: ImportResult): string {
  const action = result.created ? "Oluşturuldu" : "Güncellendi"

  return [
    `${action}: ${result.name} (${result.code}, ${result.productId}).`,
    `Varyantlar: ${result.createdVariants} yeni, ${result.updatedVariants} güncellendi, ${result.removedVariants} silindi.`,
    `Görseller: ${result.images}${result.imagesKept ? " (değişmedi, yeniden yüklenmedi)" : ""}.`,
    `Fiyat ${result.currency.toUpperCase()} olarak yazıldı; diğer para birimlerindeki fiyatlar korundu.`,
    `Kategori: ${result.category}.`,
    ...result.warnings,
    renderStock(result.stock),
  ].join("\n")
}

function renderStock(stock: StockResult): string {
  if (!stock.locations.length) {
    return "Stok yazılmadı: lokasyon seçilmedi."
  }

  return `Stok (${stock.locations.join(", ")}): ${stock.stocked} varyant en az ${IMPORT_STOCK} adet, ${stock.soldOut} varyant tükendi.`
}

export function renderPreview(product: ImportedProduct): string {
  return [
    product.name,
    `Kaynak: ${product.source} #${product.externalId}`,
    `Kod: ${product.code}`,
    `Marka: ${product.brand || "—"}`,
    `Renk: ${product.color || "—"}`,
    `Vergi: %${product.taxRate}`,
    `Para birimi: ${product.currency || "—"}`,
    `Görseller: ${product.images.length}`,
    "",
    "Özellikler",
    ...product.attributes.map((attribute) => `${attribute.name}: ${attribute.value}`),
    "",
    "Varyantlar",
    ...product.variants.map((variant) => previewVariant(variant)),
    "",
    "Diğer renkler",
    ...(product.colorUrls.length ? product.colorUrls : ["—"]),
  ].join("\n")
}

function previewVariant(variant: ImportedVariant): string {
  const options = variant.attributes.map((attribute) => attribute.value).join(" / ") || "—"

  return `${variant.barcode}  ${options}  ${variant.price ?? "—"}  ${variant.inStock ? "stokta" : "tükendi"}`
}

export function assertProduct(product: ImportedProduct): void {
  if (!product.name || !product.code || !product.externalId) {
    throw new ImportException("Ürünün adı veya kodu yok.")
  }

  if (!product.color?.trim()) {
    throw new ImportException("Ürünün rengi yok.")
  }

  if (!product.variants.length) {
    throw new ImportException("Ürünün barkodu yok.")
  }

  const barcodes = new Set<string>()
  const combinations = new Set<string>()

  for (const variant of product.variants) {
    const barcode = variant.barcode.trim()

    if (!barcode || barcode.length > 64) {
      throw new ImportException("Bir barkod eksik veya 64 karakterden uzun.")
    }

    if (barcodes.has(barcode)) {
      throw new ImportException(`Barkod ${barcode} tekrar ediyor.`)
    }

    barcodes.add(barcode)
    const combination = combinationKey(variant)

    if (combinations.has(combination)) {
      throw new ImportException("İki barkodun varyant seçenekleri aynı.")
    }

    combinations.add(combination)
  }
}

function combinationKey(variant: ImportedVariant): string {
  return JSON.stringify(
    [...variant.attributes]
      .sort((left, right) => left.name.localeCompare(right.name, "tr"))
      .map((attribute) => [attribute.name, attribute.value])
  )
}
