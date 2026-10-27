import type { BulkTranslateConfig } from "./bulk-translate-widget"
import {
  PRODUCT_ID_FIELDS,
  PRODUCT_TRANSLATION_CONTEXT,
  ProductIds,
  productTargets,
} from "./product-translation"
import {
  CATEGORY_TABLE_QUERY,
  COLLECTION_TABLE_QUERY,
  PRODUCT_OPTION_TABLE_QUERY,
  PRODUCT_TABLE_QUERY,
} from "./table-query"

type OptionIds = { id: string; values?: { id: string }[] | null }

export const PRODUCTS_BULK_TRANSLATE: BulkTranslateConfig<ProductIds> = {
  listPath: "/admin/products",
  listKey: "products",
  fields: PRODUCT_ID_FIELDS,
  query: PRODUCT_TABLE_QUERY,
  targets: productTargets,
  context: PRODUCT_TRANSLATION_CONTEXT,
  noun: "ürün",
  intro: "Tablodaki filtreye uyan tüm ürünleri, varyant ve seçenek adlarıyla birlikte mağaza dillerine çevirin.",
  buttonLabel: "Ürünleri Tercüme Et",
  disabledMessage: "Ürünler için çeviri kapalı. Ayarlar → Çeviriler bölümünden açın.",
}

export const COLLECTIONS_BULK_TRANSLATE: BulkTranslateConfig<{ id: string }> = {
  listPath: "/admin/collections",
  listKey: "collections",
  fields: "id",
  query: COLLECTION_TABLE_QUERY,
  targets: (collections) => [["product_collection", collections.map((item) => item.id)]],
  context: "product collection titles of an online store",
  noun: "koleksiyon",
  intro: "Tablodaki filtreye uyan tüm koleksiyonların adlarını mağaza dillerine çevirin.",
  buttonLabel: "Koleksiyonları Tercüme Et",
  disabledMessage: "Koleksiyonlar için çeviri kapalı. Ayarlar → Çeviriler bölümünden açın.",
}

export const CATEGORIES_BULK_TRANSLATE: BulkTranslateConfig<{ id: string }> = {
  listPath: "/admin/product-categories",
  listKey: "product_categories",
  fields: "id",
  query: CATEGORY_TABLE_QUERY,
  targets: (categories) => [["product_category", categories.map((item) => item.id)]],
  context: "product category names and descriptions of an online store",
  noun: "kategori",
  intro: "Aramaya uyan tüm kategorilerin (alt kategoriler dahil) adlarını ve açıklamalarını mağaza dillerine çevirin.",
  buttonLabel: "Kategorileri Tercüme Et",
  disabledMessage: "Kategoriler için çeviri kapalı. Ayarlar → Çeviriler bölümünden açın.",
}

export const PRODUCT_OPTIONS_BULK_TRANSLATE: BulkTranslateConfig<OptionIds> = {
  listPath: "/admin/product-options",
  listKey: "product_options",
  fields: "id,values.id",
  query: PRODUCT_OPTION_TABLE_QUERY,
  targets: (options) => [
    ["product_option", options.map((option) => option.id)],
    ["product_option_value", options.flatMap((option) => (option.values ?? []).map((value) => value.id))],
  ],
  context: "product option names (such as Color, Size) and their values of an online store",
  noun: "seçenek",
  intro: "Tablodaki filtreye uyan tüm ürün seçeneklerinin adlarını ve değerlerini mağaza dillerine çevirin.",
  buttonLabel: "Seçenekleri Tercüme Et",
  disabledMessage: "Ürün seçenekleri için çeviri kapalı. Ayarlar → Çeviriler bölümünden açın.",
}
