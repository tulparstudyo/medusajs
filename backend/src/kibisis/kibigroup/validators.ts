import { z } from "@medusajs/framework/zod"

export const AssignGroupSchema = z
  .object({
    main_code: z
      .string()
      .trim()
      .min(1, "Ana kod gerekli.")
      .max(80, "Ana kod en fazla 80 karakter olabilir."),
    color: z
      .string()
      .trim()
      .min(1, "Renk adı gerekli.")
      .max(60, "Renk adı en fazla 60 karakter olabilir."),
    color_hex: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^#[0-9a-fA-F]{6}$/.test(value),
        "Renk kodu #RRGGBB biçiminde olmalı."
      )
      .default(""),
    position: z.number().int().min(0).max(999).default(0),
  })
  .strict()

export type AssignGroupBody = z.infer<typeof AssignGroupSchema>
