import { z } from "@medusajs/framework/zod"

export const ImportProductsSchema = z.object({
  urls: z.string().trim().min(1, "En az bir ürün linki girin.").max(100_000),
  category_id: z.string().trim().min(1, "Kategori seçin."),
  location_ids: z.array(z.string().trim().min(1)).max(50).default([]),
  currency_code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3}$/, "Para birimi seçin.")
    .optional(),
})

export type ImportProductsInput = z.infer<typeof ImportProductsSchema>
