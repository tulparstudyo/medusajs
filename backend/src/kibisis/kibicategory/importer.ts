import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow, updateProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"

import { planHandleRebuild } from "./handles"
import { ExistingCategory, PlanEntry, planCategories } from "./plan"
import { CategoryDocumentSchema, toTree } from "./schema"
import { CategoryImportResult, HandleRebuildResult } from "./types"

const CREATE_CHUNK = 100

type Graph = {
  graph: (args: { entity: string; fields: string[] }) => Promise<{ data: Record<string, unknown>[] }>
}

export type CategoryImportInput = {
  document: unknown
  parent_id?: string | null
  is_active?: boolean
  is_internal?: boolean
  dry_run?: boolean
}

/**
 * ImportCategories plans the tree under the chosen parent and, unless it is
 * a dry run, creates the missing categories level by level. A failed run
 * can simply be repeated: categories already created are matched by name.
 */
export async function importCategories(
  container: MedusaContainer,
  input: CategoryImportInput
): Promise<CategoryImportResult> {
  const parsed = CategoryDocumentSchema.safeParse(input.document)

  if (!parsed.success) {
    throw invalid(
      parsed.error.issues
        .slice(0, 20)
        .map((issue) => `${issue.path.join(".") || "kök"}: ${issue.message}`)
        .join("\n")
    )
  }

  let tree: ReturnType<typeof toTree>

  try {
    tree = toTree(parsed.data)
  } catch (error) {
    throw invalid((error as Error).message)
  }

  const existing = await loadCategories(container)
  const parentId = input.parent_id?.trim() || null

  if (parentId && !existing.some((category) => category.id === parentId)) {
    throw invalid("Üst kategori bulunamadı.")
  }

  const plan = planCategories(tree, existing, parentId, {
    isActive: input.is_active ?? true,
    isInternal: input.is_internal ?? false,
  })

  if (!input.dry_run) {
    await createPlanned(container, plan)
  }

  const created = plan.filter((entry) => entry.action === "create").length

  return {
    dry_run: input.dry_run === true,
    parent_id: parentId,
    total: plan.length,
    created,
    existing: plan.length - created,
    entries: plan.map((entry) => ({
      path: entry.path,
      depth: entry.depth,
      name: entry.name,
      handle: entry.handle,
      action: entry.action,
      id: entry.id,
    })),
  }
}

/**
 * RebuildHandles gives the chosen category and everything below it (or the
 * whole catalogue) handles that follow the tree, e.g. "kadin/elbise".
 * Categories that would swap handles first move to a temporary handle so
 * the unique index never sees two equal values.
 */
export async function rebuildHandles(
  container: MedusaContainer,
  input: { parent_id?: string | null; dry_run?: boolean }
): Promise<HandleRebuildResult> {
  const categories = await loadCategories(container)
  const rootId = input.parent_id?.trim() || null

  if (rootId && !categories.some((category) => category.id === rootId)) {
    throw invalid("Kategori bulunamadı.")
  }

  const changes = planHandleRebuild(categories, rootId)

  if (!input.dry_run && changes.length) {
    const targets = new Set(changes.map((change) => change.to.toLowerCase()))
    const blocking = changes.filter((change) => targets.has(change.from.toLowerCase()))

    for (const change of blocking) {
      await setHandle(container, change.id, `tmp-${change.id.toLowerCase()}`)
    }

    for (const change of changes) {
      await setHandle(container, change.id, change.to)
    }
  }

  return {
    dry_run: input.dry_run === true,
    parent_id: rootId,
    changed: changes.length,
    changes: changes.map((change) => ({
      id: change.id,
      path: change.path,
      from: change.from,
      to: change.to,
    })),
  }
}

async function setHandle(container: MedusaContainer, id: string, handle: string): Promise<void> {
  await updateProductCategoriesWorkflow(container).run({
    input: { selector: { id }, update: { handle } },
  })
}

export async function loadCategories(container: MedusaContainer): Promise<ExistingCategory[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as Graph
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "parent_category_id"],
  })

  return data.flatMap((row) =>
    typeof row.id === "string" && typeof row.name === "string"
      ? [
          {
            id: row.id,
            name: row.name,
            handle: typeof row.handle === "string" ? row.handle : "",
            parentId: typeof row.parent_category_id === "string" ? row.parent_category_id : null,
          },
        ]
      : []
  )
}

async function createPlanned(container: MedusaContainer, plan: PlanEntry[]): Promise<void> {
  const ids = new Map(plan.flatMap((entry) => (entry.id ? [[entry.key, entry.id] as const] : [])))
  const depths = [...new Set(plan.map((entry) => entry.depth))].sort((left, right) => left - right)

  for (const depth of depths) {
    const level = plan.filter((entry) => entry.depth === depth && entry.action === "create")

    for (let start = 0; start < level.length; start += CREATE_CHUNK) {
      const chunk = level.slice(start, start + CREATE_CHUNK)
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: chunk.map((entry) => {
            const parentId = entry.parentKey ? ids.get(entry.parentKey) : entry.parentId

            if (entry.parentKey && !parentId) {
              throw invalid(`${entry.path.join(" > ")} için üst kategori oluşturulamadı.`)
            }

            return {
              name: entry.name,
              handle: entry.handle,
              is_active: entry.isActive,
              is_internal: entry.isInternal,
              parent_category_id: parentId ?? null,
              ...(entry.description ? { description: entry.description } : {}),
            }
          }),
        },
      })
      const byHandle = new Map(result.map((category) => [category.handle, category.id]))

      for (const entry of chunk) {
        const id = byHandle.get(entry.handle) ?? null
        entry.id = id

        if (id) {
          ids.set(entry.key, id)
        }
      }
    }
  }
}

function invalid(message: string): MedusaError {
  return new MedusaError(MedusaError.Types.INVALID_DATA, message)
}
