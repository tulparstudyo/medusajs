import { z } from "@medusajs/framework/zod"

import {
  BANNER_LAYOUTS,
  BANNER_TONES,
  FAST_LINK_VARIANTS,
  ICON_BOX_TONES,
  isSectionIcon,
  PAGE_KEY_PATTERN,
  PRODUCT_SOURCES,
  QUICK_CATEGORY_TONES,
  SECTION_TYPES,
} from "./types"

function isAddress(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true
  }

  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const addressMessage = "Adres / ile başlamalı veya http(s) adresi olmalıdır."

function address(requiredMessage: string) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .max(2000)
    .refine(isAddress, addressMessage)
}

const href = address("Bağlantı gerekli.")

const optionalHref = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === "" || isAddress(value), addressMessage)

const quickCategoryItem = z
  .object({
    id: z.string().trim().min(1).max(80),
    icon: z.string().refine((value) => isSectionIcon(value), "İkon geçersiz."),
    title: z.string().trim().min(1, "Ad gerekli.").max(40),
    label: z.string().trim().min(1, "Etiket gerekli.").max(60),
    href,
    tone: z.enum(QUICK_CATEGORY_TONES),
  })
  .strict()

export const QuickCategoriesSettingsSchema = z
  .object({
    items: z.array(quickCategoryItem).max(40),
  })
  .strict()

const heroCard = z
  .object({
    eyebrow: z.string().trim().max(40),
    title: z.string().trim().max(80),
    text: z.string().trim().max(180),
    action: z.string().trim().max(40),
    href: optionalHref,
    icon: z
      .string()
      .refine((value) => value === "" || isSectionIcon(value), "İkon geçersiz."),
  })
  .strict()

const heroSlide = z
  .object({
    id: z.string().trim().min(1).max(80),
    image: address("Resim adresi gerekli."),
    href,
  })
  .strict()

export const HeroShowcaseSettingsSchema = z
  .object({
    slides: z.array(heroSlide).max(12),
    primary: heroCard,
    secondary: heroCard,
  })
  .strict()

const promoBannerItem = z
  .object({
    id: z.string().trim().min(1).max(80),
    eyebrow: z.string().trim().max(60),
    title: z.string().trim().min(1, "Başlık gerekli.").max(80),
    text: z.string().trim().max(180),
    action: z.string().trim().max(40),
    href,
    tone: z.enum(BANNER_TONES),
  })
  .strict()

export const PromoBannerSettingsSchema = z
  .object({
    layout: z.enum(BANNER_LAYOUTS).default("grid"),
    columns: z.number().int().min(1).max(6).default(3),
    visible: z.number().int().min(1).max(6).default(1),
    items: z.array(promoBannerItem).max(24).default([]),
  })
  .strict()

const optionalImage = z
  .string()
  .trim()
  .max(2000)
  .default("")
  .refine(
    (value) =>
      value === "" || isAddress(value) || isSectionIcon(value),
    "İkon adresi / ile başlamalı, http(s) olmalı veya geçerli bir ikon adı olmalıdır."
  )

const fastLinkItem = z
  .object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1, "Metin gerekli.").max(60),
    href,
    icon: optionalImage,
    accent: z.boolean().default(false),
  })
  .strict()

export const UploadSectionFileSchema = z
  .object({
    filename: z.string().trim().min(1, "Dosya adı gerekli.").max(200),
    mime_type: z.string().trim().min(1, "Dosya türü gerekli.").max(100),
    content: z.string().min(1, "Dosya içeriği gerekli.").max(4_000_000),
  })
  .strict()

export const FastLinksSettingsSchema = z
  .object({
    title: z.string().trim().max(120).default(""),
    variant: z.enum(FAST_LINK_VARIANTS).default("outline"),
    items: z.array(fastLinkItem).max(40).default([]),
  })
  .strict()

const iconBoxItem = z
  .object({
    id: z.string().trim().min(1).max(80),
    icon: z.string().refine((value) => isSectionIcon(value), "İkon geçersiz."),
    title: z.string().trim().min(1, "Başlık gerekli.").max(60),
    text: z.string().trim().max(180).default(""),
    tone: z.enum(ICON_BOX_TONES),
  })
  .strict()

export const IconBoxSettingsSchema = z
  .object({
    items: z.array(iconBoxItem).max(12).default([]),
  })
  .strict()

export const HtmlContentSettingsSchema = z
  .object({
    html: z.string().max(200_000).default(""),
  })
  .strict()

export const SelectedProductSettingsSchema = z
  .object({
    title: z.string().trim().max(120).default(""),
    source: z.enum(PRODUCT_SOURCES).default("new"),
    limit: z.number().int().min(1).max(24).default(8),
    product_ids: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
    tag_id: z.string().trim().max(80).default(""),
    image_width: z.number().int().min(0).max(4096).default(0),
    image_height: z.number().int().min(0).max(4096).default(0),
  })
  .strict()

export const EmptySettingsSchema = z.object({}).strict()

export const PageKeySchema = z
  .string()
  .trim()
  .min(1, "Sayfa anahtarı gerekli.")
  .max(80, "Sayfa anahtarı en fazla 80 karakter olabilir.")
  .regex(
    PAGE_KEY_PATTERN,
    "Sayfa anahtarı yalnızca küçük harf, rakam ve tire içerebilir."
  )

export const CreatePageSchema = z
  .object({
    page_key: PageKeySchema,
    label: z
      .string()
      .trim()
      .min(1, "Sayfa adı gerekli.")
      .max(120, "Sayfa adı en fazla 120 karakter olabilir."),
  })
  .strict()

export const UpdatePageSchema = CreatePageSchema

export const CreateSectionSchema = z
  .object({
    type: z.enum(SECTION_TYPES),
    name: z.string().trim().max(80).optional(),
    is_active: z.boolean().optional(),
    settings: z.unknown().optional(),
  })
  .strict()

export const UpdateSectionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Bölüm adı gerekli.")
      .max(80, "Bölüm adı en fazla 80 karakter olabilir."),
    is_active: z.boolean(),
    settings: z.unknown(),
  })
  .strict()

export const ReorderSectionsSchema = z
  .object({
    page_key: PageKeySchema,
    items: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            position: z.number().int().nonnegative(),
          })
          .strict()
      )
      .max(200),
  })
  .strict()
