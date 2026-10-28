import { z } from "@medusajs/framework/zod"

const MAX_DEPTH = 10
const MAX_NODES = 5000

export type CategoryNodeInput =
  | string
  | {
      category?: string
      name?: string
      handle?: string
      description?: string
      is_active?: boolean
      is_internal?: boolean
      subcategories?: CategoryNodeInput[]
      children?: CategoryNodeInput[]
    }

const name = z.string().trim().min(1, "Kategori adı boş olamaz.").max(255)

export const CategoryNodeSchema: z.ZodType<CategoryNodeInput> = z.lazy(() =>
  z.union([
    name,
    z
      .object({
        category: name.optional(),
        name: name.optional(),
        handle: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(5000).optional(),
        is_active: z.boolean().optional(),
        is_internal: z.boolean().optional(),
        subcategories: z.array(CategoryNodeSchema).optional(),
        children: z.array(CategoryNodeSchema).optional(),
      })
      .refine((node) => node.category || node.name, "category veya name gerekli."),
  ])
)

/** A document is a list of top categories, or `{ "categories": [...] }`. */
export const CategoryDocumentSchema = z.union([
  z.array(CategoryNodeSchema).min(1, "En az bir kategori gerekli."),
  z.object({ categories: z.array(CategoryNodeSchema).min(1, "En az bir kategori gerekli.") }),
])

export type CategoryTree = {
  name: string
  handle?: string
  description?: string
  isActive?: boolean
  isInternal?: boolean
  children: CategoryTree[]
}

/**
 * ToTree reads a parsed document into a tree. Siblings with the same name
 * merge into one, so a category listed twice keeps the subcategories of both.
 */
export function toTree(document: z.infer<typeof CategoryDocumentSchema>): CategoryTree[] {
  let count = 0

  const visit = (nodes: CategoryNodeInput[], depth: number): CategoryTree[] => {
    if (depth > MAX_DEPTH) {
      throw new Error(`Kategori ağacı en fazla ${MAX_DEPTH} seviye olabilir.`)
    }

    const merged: CategoryTree[] = []

    for (const node of nodes) {
      count += 1

      if (count > MAX_NODES) {
        throw new Error(`Bir dosyada en fazla ${MAX_NODES} kategori olabilir.`)
      }

      const entry: CategoryTree =
        typeof node === "string"
          ? { name: node.trim(), children: [] }
          : {
              name: (node.category ?? node.name ?? "").trim(),
              handle: node.handle,
              description: node.description,
              isActive: node.is_active,
              isInternal: node.is_internal,
              children: visit([...(node.subcategories ?? []), ...(node.children ?? [])], depth + 1),
            }
      const twin = merged.find((item) => sameName(item.name, entry.name))

      if (twin) {
        twin.children = mergeSiblings([...twin.children, ...entry.children])
        twin.handle ??= entry.handle
        twin.description ??= entry.description
        twin.isActive ??= entry.isActive
        twin.isInternal ??= entry.isInternal
      } else {
        merged.push(entry)
      }
    }

    return merged
  }

  return visit(Array.isArray(document) ? document : document.categories, 1)
}

function mergeSiblings(nodes: CategoryTree[]): CategoryTree[] {
  const merged: CategoryTree[] = []

  for (const node of nodes) {
    const twin = merged.find((item) => sameName(item.name, node.name))

    if (twin) {
      twin.children = mergeSiblings([...twin.children, ...node.children])
    } else {
      merged.push(node)
    }
  }

  return merged
}

export function sameName(left: string, right: string): boolean {
  return normalizeName(left) === normalizeName(right)
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR")
}
