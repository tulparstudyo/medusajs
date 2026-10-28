import { z } from "@medusajs/framework/zod"

export const ImportCategoriesSchema = z.object({
  document: z.unknown(),
  parent_id: z.string().trim().max(100).nullable().optional(),
  is_active: z.boolean().optional(),
  is_internal: z.boolean().optional(),
  dry_run: z.boolean().optional(),
})

export type ImportCategoriesBody = z.infer<typeof ImportCategoriesSchema>

export const RebuildHandlesSchema = z.object({
  parent_id: z.string().trim().max(100).nullable().optional(),
  dry_run: z.boolean().optional(),
})

export type RebuildHandlesBody = z.infer<typeof RebuildHandlesSchema>
