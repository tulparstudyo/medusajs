import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductTagsWorkflow, createProductTypesWorkflow } from "@medusajs/medusa/core-flows"

import { CategoryRef } from "./schema"

type Row = Record<string, unknown>

type Graph = {
  graph: (args: { entity: string; fields: string[]; filters?: Record<string, unknown> }) => Promise<{
    data: Row[]
  }>
}

export type CategoryIndex = {
  byId: Map<string, string>
  byHandle: Map<string, string>
  byPath: Map<string, string>
}

export type Resolved<T> = { value: T; warnings: string[] }

export async function loadCategoryIndex(container: MedusaContainer): Promise<CategoryIndex> {
  const { data } = await graph(container).graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "parent_category_id"],
  })
  const rows = new Map(
    data.flatMap((row): [string, { name: string; handle: string; parentId: string | null }][] =>
      typeof row.id === "string" && typeof row.name === "string"
        ? [
            [
              row.id,
              {
                name: row.name,
                handle: typeof row.handle === "string" ? row.handle : "",
                parentId: typeof row.parent_category_id === "string" ? row.parent_category_id : null,
              },
            ],
          ]
        : []
    )
  )
  const index: CategoryIndex = { byId: new Map(), byHandle: new Map(), byPath: new Map() }

  for (const [id, row] of rows) {
    const names: string[] = []
    const seen = new Set<string>()

    for (let current: string | null = id; current && !seen.has(current); ) {
      seen.add(current)
      const node = rows.get(current)

      if (!node) {
        break
      }

      names.unshift(node.name)
      current = node.parentId
    }

    index.byId.set(id, id)

    if (row.handle) {
      index.byHandle.set(normalize(row.handle), id)
    }

    index.byPath.set(pathKey(names), id)
  }

  return index
}

/** ResolveCategories finds each reference by id, handle or the names from the top category down. */
export function resolveCategories(index: CategoryIndex, refs: CategoryRef[]): Resolved<string[]> {
  const ids: string[] = []
  const warnings: string[] = []

  for (const ref of refs) {
    const id = categoryId(index, ref)

    if (id) {
      if (!ids.includes(id)) {
        ids.push(id)
      }
    } else {
      warnings.push(`Kategori bulunamadı: ${describeRef(ref)}`)
    }
  }

  return { value: ids, warnings }
}

export async function resolveCollection(
  container: MedusaContainer,
  handle: string | null | undefined
): Promise<Resolved<string | null | undefined>> {
  if (handle === undefined) {
    return { value: undefined, warnings: [] }
  }

  if (handle === null || !handle.trim()) {
    return { value: null, warnings: [] }
  }

  const { data } = await graph(container).graph({
    entity: "product_collection",
    fields: ["id", "handle"],
    filters: { handle: handle.trim() },
  })
  const id = data.find((row) => typeof row.id === "string")?.id as string | undefined

  return id
    ? { value: id, warnings: [] }
    : { value: undefined, warnings: [`Koleksiyon bulunamadı: ${handle}`] }
}

/** ResolveType finds the product type by its value and creates it when the store has none. */
export async function resolveType(
  container: MedusaContainer,
  value: string | null | undefined
): Promise<string | null | undefined> {
  if (value === undefined) {
    return undefined
  }

  if (value === null || !value.trim()) {
    return null
  }

  const { data } = await graph(container).graph({ entity: "product_type", fields: ["id", "value"] })
  const existing = data.find(
    (row) => typeof row.value === "string" && normalize(row.value) === normalize(value)
  )

  if (typeof existing?.id === "string") {
    return existing.id
  }

  const { result } = await createProductTypesWorkflow(container).run({
    input: { product_types: [{ value: value.trim() }] },
  })

  return result[0]?.id
}

/** ResolveTags finds tags by value and creates the missing ones. */
export async function resolveTags(
  container: MedusaContainer,
  values: string[] | undefined
): Promise<string[] | undefined> {
  if (values === undefined) {
    return undefined
  }

  const wanted = [...new Map(values.map((value) => [normalize(value), value.trim()])).values()].filter(Boolean)

  if (!wanted.length) {
    return []
  }

  const { data } = await graph(container).graph({
    entity: "product_tag",
    fields: ["id", "value"],
    filters: { value: wanted },
  })
  const found = new Map(
    data.flatMap((row): [string, string][] =>
      typeof row.id === "string" && typeof row.value === "string" ? [[normalize(row.value), row.id]] : []
    )
  )
  const missing = wanted.filter((value) => !found.has(normalize(value)))

  if (missing.length) {
    const { result } = await createProductTagsWorkflow(container).run({
      input: { product_tags: missing.map((value) => ({ value })) },
    })

    for (const tag of result) {
      found.set(normalize(tag.value), tag.id)
    }
  }

  return wanted.flatMap((value) => {
    const id = found.get(normalize(value))
    return id ? [id] : []
  })
}

function categoryId(index: CategoryIndex, ref: CategoryRef): string | undefined {
  if (typeof ref === "string") {
    return (
      index.byHandle.get(normalize(ref)) ??
      index.byId.get(ref) ??
      index.byPath.get(pathKey(ref.split(/\s*[/>]\s*/)))
    )
  }

  return (
    (ref.id ? index.byId.get(ref.id) : undefined) ??
    (ref.handle ? index.byHandle.get(normalize(ref.handle)) : undefined) ??
    (ref.path ? index.byPath.get(pathKey(ref.path)) : undefined)
  )
}

function describeRef(ref: CategoryRef): string {
  if (typeof ref === "string") {
    return ref
  }

  return ref.handle ?? ref.path?.join(" / ") ?? ref.id ?? "?"
}

function pathKey(names: string[]): string {
  return names.map(normalize).filter(Boolean).join("\u0000")
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR")
}

function graph(container: MedusaContainer): Graph {
  return container.resolve(ContainerRegistrationKeys.QUERY) as Graph
}
