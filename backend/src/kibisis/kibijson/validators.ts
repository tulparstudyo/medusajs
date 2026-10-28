import { z } from "@medusajs/framework/zod"

import { isSafeRelativePath } from "./local-images"
import { ITEM_STATUSES } from "./types"

const relativePath = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || isSafeRelativePath(value), "Görsel klasörüne göre bir yol girin.")

export const CreateBatchSchema = z.object({
  document: z.unknown().optional(),
  file: relativePath.optional(),
  name: z.string().trim().max(200).optional(),
  image_base: relativePath.nullable().optional(),
})

export type CreateBatchBody = z.infer<typeof CreateBatchSchema>

export const StartBatchSchema = z.object({
  category_id: z.string().trim().max(100).nullable().optional(),
  location_ids: z.array(z.string().trim().min(1)).max(50).default([]),
  currency_code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3}$/, "Para birimi seçin.")
    .optional(),
  options: z
    .object({
      skip_unchanged: z.boolean().optional(),
      archive_images: z.boolean().optional(),
    })
    .optional(),
})

export type StartBatchBody = z.infer<typeof StartBatchSchema>

export const ItemsQuerySchema = z.object({
  status: z.enum(ITEM_STATUSES).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})
