import { z } from "@medusajs/framework/zod"

export const InstallPaymentSchema = z
  .object({
    repo: z.string().trim().regex(/^kibisis-[a-z0-9-]{2,60}$/, "Geçersiz paket repo adı."),
  })
  .strict()

export type InstallPaymentInput = z.infer<typeof InstallPaymentSchema>

