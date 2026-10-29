import { z } from "@medusajs/framework/zod"

const locale = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{2,3}([-_][A-Za-z0-9]{2,8})*$/, "Dil kodu geçersiz.")

export const MAX_TRANSLATE_TEXT_LENGTH = 200_000

export const TranslateTextsSchema = z
  .object({
    source: locale,
    target: locale,
    texts: z
      .array(
        z
          .string()
          .max(
            MAX_TRANSLATE_TEXT_LENGTH,
            `Bir metin en fazla ${MAX_TRANSLATE_TEXT_LENGTH} karakter olabilir.`
          )
      )
      .min(1, "Çevrilecek metin yok.")
      .max(500, "Tek seferde en fazla 500 metin çevrilebilir."),
    format: z.enum(["text", "html"]).default("text"),
    context: z.string().trim().max(200).optional(),
  })
  .strict()

export type TranslateTextsInput = z.infer<typeof TranslateTextsSchema>

export const MemoryListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  source_locale: z.string().trim().max(20).optional(),
  target_locale: z.string().trim().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const EditMemorySchema = z
  .object({
    translated_text: z
      .string()
      .trim()
      .min(1, "Çeviri boş olamaz.")
      .max(
        MAX_TRANSLATE_TEXT_LENGTH,
        `Çeviri en fazla ${MAX_TRANSLATE_TEXT_LENGTH} karakter olabilir.`
      ),
  })
  .strict()

export type EditMemoryInput = z.infer<typeof EditMemorySchema>

export const DeleteMemorySchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).min(1, "Silinecek kayıt seçin.").max(500),
  })
  .strict()

export type DeleteMemoryInput = z.infer<typeof DeleteMemorySchema>
