import { z } from "@medusajs/framework/zod"

export const ImportProductsSchema = z.object({
  urls: z.string().trim().min(1, "En az bir ürün linki girin.").max(100_000),
  category_id: z.string().trim().min(1, "Kategori seçin."),
})

export type ImportProductsInput = z.infer<typeof ImportProductsSchema>
