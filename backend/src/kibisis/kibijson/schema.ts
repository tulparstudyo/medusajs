import { z } from "@medusajs/framework/zod"

import { roundMoney } from "../kibiimport/money"
import { isSafeRelativePath } from "./local-images"

export const PRODUCT_SCHEMA = "kibiimport.product/v1"

const MAX_PRODUCTS = 5000
const MAX_VARIANTS = 500
const MAX_IMAGES = 50

const text = (max: number) => z.string().trim().max(max)
const optionalText = (max: number) => text(max).nullable().optional()
const scalar = z.union([z.string(), z.number(), z.boolean()]).transform((value) => String(value).trim())

const money = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const amount = roundMoney(value)

  if (amount === null) {
    ctx.addIssue({ code: "custom", message: "Geçersiz tutar." })
    return z.NEVER
  }

  return amount
})

const measure = z.number().nonnegative().nullable().optional()

const relativePath = text(500)
  .min(1)
  .refine(isSafeRelativePath, "Göreli bir yol olmalı; '..', '\\' ve mutlak yol kullanılamaz.")

const httpUrl = text(2000).refine((value) => /^https?:\/\//i.test(value), "http(s) linki olmalı.")

const physical = z.object({
  weight: measure,
  length: measure,
  height: measure,
  width: measure,
  material: optionalText(200),
  origin_country: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}$/, "İki harfli ülke kodu olmalı.")
    .nullable()
    .optional(),
  hs_code: optionalText(50),
  mid_code: optionalText(50),
})

const image = z.union([
  text(2000).min(1),
  z.object({
    key: text(100).min(1).optional(),
    path: relativePath.optional(),
    url: httpUrl.optional(),
    alt: optionalText(300),
    position: z.number().int().nonnegative().optional(),
  }),
])

const category = z.union([
  text(200).min(1),
  z
    .object({
      id: text(100).min(1).optional(),
      handle: text(200).min(1).optional(),
      path: z.array(text(200).min(1)).min(1).max(10).optional(),
    })
    .refine((value) => value.id || value.handle || value.path, "id, handle veya path gerekli."),
])

const price = z.object({
  currency_code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3}$/, "Üç harfli para birimi kodu olmalı."),
  amount: money,
  compare_at_amount: money.nullable().optional(),
})

const variant = z.object({
  external_id: scalar.optional(),
  barcode: text(64).min(1, "Barkod gerekli."),
  sku: optionalText(120),
  ean: optionalText(64),
  upc: optionalText(64),
  title: optionalText(300),
  options: z.record(text(100).min(1), scalar).default({}),
  prices: z.array(price).max(50).default([]),
  inventory: z
    .object({
      in_stock: z.boolean().optional(),
      quantity: z.number().int().nonnegative().nullable().optional(),
      manage_inventory: z.boolean().optional(),
      allow_backorder: z.boolean().optional(),
    })
    .default({}),
  physical: physical.optional(),
  images: z.array(z.union([text(100).min(1), z.number().int().nonnegative()])).max(MAX_IMAGES).optional(),
  sort_order: z.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const translation = z.object({
  title: optionalText(500),
  subtitle: optionalText(500),
  description: optionalText(100_000),
  material: optionalText(200),
  options: z
    .record(
      text(100).min(1),
      z.object({
        title: optionalText(100),
        values: z.record(z.string(), text(200)).optional(),
      })
    )
    .optional(),
  variants: z
    .record(
      text(64).min(1),
      z.object({ title: optionalText(300), material: optionalText(200) })
    )
    .optional(),
})

export const ProductDocumentSchema = z
  .object({
    external_id: scalar.pipe(z.string().min(1, "external_id gerekli.").max(200)),
    code: text(120).min(1, "code gerekli."),
    source_url: httpUrl.nullable().optional(),
    locale: text(20).min(2).optional(),
    status: z.enum(["published", "draft"]).optional(),
    title: text(500).min(1, "title gerekli."),
    subtitle: optionalText(500),
    description: optionalText(100_000),
    handle: optionalText(200),
    brand: optionalText(200),
    color: z.union([
      text(100).min(1),
      z.object({
        name: text(100).min(1, "Renk adı gerekli."),
        hex: z
          .string()
          .trim()
          .regex(/^#[0-9a-fA-F]{6}$/, "#RRGGBB biçiminde olmalı.")
          .nullable()
          .optional(),
      }),
    ]),
    group: z
      .object({
        main_code: text(120).min(1).optional(),
        position: z.number().int().optional(),
      })
      .optional(),
    categories: z.array(category).max(20).optional(),
    collection: optionalText(200),
    type: optionalText(200),
    tags: z.array(text(100).min(1)).max(50).optional(),
    currency: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z]{3}$/, "Üç harfli para birimi kodu olmalı.")
      .optional(),
    tax_rate: z.union([z.string(), z.number()]).transform(String).optional(),
    discountable: z.boolean().optional(),
    physical: physical.optional(),
    seo: z.record(z.string(), z.unknown()).optional(),
    attributes: z.array(z.object({ name: text(200).min(1), value: scalar })).max(200).default([]),
    images: z.array(image).max(MAX_IMAGES).optional(),
    options: z
      .array(z.object({ title: text(100).min(1), values: z.array(scalar).max(500).optional() }))
      .max(10)
      .optional(),
    variants: z.array(variant).min(1, "En az bir varyant gerekli.").max(MAX_VARIANTS),
    translations: z.record(text(20).min(2), translation).optional(),
    related: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((product, ctx) => {
    const keys = new Set<string>()

    product.images?.forEach((entry, index) => {
      if (typeof entry === "string") {
        if (!/^https?:\/\//i.test(entry) && !isSafeRelativePath(entry)) {
          ctx.addIssue({
            code: "custom",
            path: ["images", index],
            message: "Göreli bir yol veya http(s) linki olmalı.",
          })
        }
        return
      }

      if (Boolean(entry.path) === Boolean(entry.url)) {
        ctx.addIssue({
          code: "custom",
          path: ["images", index],
          message: "path veya url alanlarından tam olarak biri gerekli.",
        })
      }

      if (entry.key) {
        if (keys.has(entry.key)) {
          ctx.addIssue({ code: "custom", path: ["images", index, "key"], message: "Görsel anahtarı tekrar ediyor." })
        }
        keys.add(entry.key)
      }
    })

    const count = product.images?.length ?? 0

    product.variants.forEach((row, index) => {
      for (const ref of row.images ?? []) {
        const known = typeof ref === "number" ? ref < count : keys.has(ref)

        if (!known) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", index, "images"],
            message: `Görsel bulunamadı: ${ref}`,
          })
        }
      }
    })
  })

export type ProductDocument = z.infer<typeof ProductDocumentSchema>
export type ImageEntry = NonNullable<ProductDocument["images"]>[number]
export type CategoryRef = NonNullable<ProductDocument["categories"]>[number]

export const EnvelopeSchema = z.object({
  schema: z.literal(PRODUCT_SCHEMA, { message: `schema "${PRODUCT_SCHEMA}" olmalı.` }),
  source: text(100).min(1, "source gerekli."),
  generated_at: z.string().optional(),
  image_base: z.union([z.literal(""), relativePath]).nullable().optional(),
  defaults: z
    .object({
      locale: text(20).min(2).optional(),
      currency: z.string().trim().toLowerCase().regex(/^[a-z]{3}$/).optional(),
    })
    .optional(),
  products: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, "En az bir ürün gerekli.")
    .max(MAX_PRODUCTS, `Bir dosyada en fazla ${MAX_PRODUCTS} ürün olabilir.`),
})

export type Envelope = z.infer<typeof EnvelopeSchema>

/** IssueLines renders zod issues as "products.2.variants.0.barcode: message". */
export function issueLines(error: z.ZodError, prefix: (string | number)[] = []): string[] {
  return error.issues.map((issue) => {
    const where = [...prefix, ...issue.path.map((part) => String(part))].join(".")
    return where ? `${where}: ${issue.message}` : issue.message
  })
}
