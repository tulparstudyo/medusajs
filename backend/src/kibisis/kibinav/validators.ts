import { z } from "@medusajs/framework/zod"

import { NAV_ALIGNS, NAV_MENUS } from "./types"

const label = z
  .string()
  .trim()
  .min(1, "Etiket gerekli.")
  .max(120, "Etiket en fazla 120 karakter olabilir.")

const parentId = z.union([z.string().trim().min(1), z.null()]).optional()

const httpUrl = z
  .string()
  .trim()
  .min(1, "Bağlantı gerekli.")
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }, "Yalnızca http:// veya https:// bağlantısı girin.")

const anchor = z
  .string()
  .trim()
  .min(1, "Sayfa içi bağlantı gerekli.")
  .max(500)
  .refine((value) => {
    if (value.startsWith("/")) {
      return !value.startsWith("//") && !/\s/.test(value)
    }

    const withHash = value.startsWith("#") ? value : `#${value}`
    return /^#[A-Za-z0-9][A-Za-z0-9_-]*$/.test(withHash)
  }, "Sayfa içi bağlantı / veya # ile başlamalıdır. Örnek: /static/hakkimizda veya #hedef")

const flags = {
  align: z.enum(NAV_ALIGNS).optional(),
  is_active: z.boolean().optional(),
  new_tab: z.boolean().optional(),
}

const categoryFields = {
  target_type: z.literal("category"),
  category_id: z.string().trim().min(1, "Kategori seçin."),
}

const urlFields = {
  target_type: z.literal("url"),
  url: httpUrl,
}

const anchorFields = {
  target_type: z.literal("anchor"),
  anchor,
}

export const CreateNavItemSchema = z.discriminatedUnion("target_type", [
  z.object({ menu: z.enum(NAV_MENUS), label, parent_id: parentId, ...flags, ...categoryFields }).strict(),
  z.object({ menu: z.enum(NAV_MENUS), label, parent_id: parentId, ...flags, ...urlFields }).strict(),
  z.object({ menu: z.enum(NAV_MENUS), label, parent_id: parentId, ...flags, ...anchorFields }).strict(),
])

export const UpdateNavItemSchema = z.discriminatedUnion("target_type", [
  z.object({ label, ...flags, ...categoryFields }).strict(),
  z.object({ label, ...flags, ...urlFields }).strict(),
  z.object({ label, ...flags, ...anchorFields }).strict(),
])

export const ReorderNavSchema = z
  .object({
    menu: z.enum(NAV_MENUS),
    items: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            parent_id: z.union([z.string().trim().min(1), z.null()]),
            position: z.number().int().nonnegative(),
          })
          .strict()
      )
      .max(1000),
  })
  .strict()

export const MenuParamSchema = z.enum(NAV_MENUS)
