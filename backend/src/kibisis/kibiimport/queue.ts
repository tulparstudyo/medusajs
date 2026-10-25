import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

import { ImportException } from "./errors"
import { importProduct, renderResult } from "./importer"
import { KIBIIMPORT_MODULE } from "./index"
import { categoryPaths } from "./lib/categories"
import { splitProductUrls } from "./lib/urls"
import { SourceRegistry } from "./registry"
import KibiimportModuleService from "./service"
import { CategoryOption, ImportJobDTO, ImportSummary } from "./types"

const STALE_MS = 10 * 60 * 1000

type JobClaim = {
  id: string
  url: string
  category_id: string
}

type Query = {
  where: (column: string, operator?: unknown, value?: unknown) => Query
  whereNull: (column: string) => Query
  andWhere: (callback: (query: Query) => void) => Query
  orWhere: (column: string, operator: unknown, value: unknown) => Query
  orWhereNull: (column: string) => Query
  orderBy: (column: string, direction: string) => Query
  forUpdate: () => Query
  first: () => Promise<JobClaim | undefined>
  update: (values: Record<string, unknown>) => Promise<number>
}

type Database = {
  (table: string): Query
  transaction: <T>(callback: (trx: Database) => Promise<T>) => Promise<T>
  fn: { now: () => unknown }
}

type Graph = {
  graph: (args: {
    entity: string
    fields: string[]
  }) => Promise<{
    data: { id?: string; name?: string; parent_category_id?: string | null; rank?: number | null }[]
  }>
}

export async function queueAndDrain(
  container: MedusaContainer,
  input: { urls: string; category_id: string }
): Promise<{ jobs: ImportJobDTO[]; summary: ImportSummary }> {
  const service = container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService
  await assertCategory(container, input.category_id)

  const urls = splitProductUrls(input.urls)

  if (!urls.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "En az bir ürün linki girin.")
  }

  const created: { id: string }[] = []
  const skipped: string[] = []
  const registry = new SourceRegistry()
  const seen = new Set<string>()

  for (const url of urls) {
    if (seen.has(url)) {
      skipped.push(`${url} — Bu link zaten kuyrukta.`)
      continue
    }

    seen.add(url)

    try {
      registry.match(url)
    } catch (error) {
      skipped.push(`${url} — ${messageOf(error)}`)
      continue
    }

    if (await service.isWaiting(url)) {
      skipped.push(`${url} — Bu link zaten kuyrukta.`)
      continue
    }

    created.push(
      await service.createPending({
        url,
        category_id: input.category_id,
      })
    )
  }

  if (!created.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, skipped.join(" "))
  }

  await drain(container)

  const fresh = await service.listRecent()
  const createdIds = new Set(created.map((job) => job.id))
  const finished = fresh.filter((job) => createdIds.has(job.id))
  const jobs = await withCategories(container, service, fresh)

  return {
    jobs,
    summary: summarize(
      finished.map((job) => service.toJob(job, null)),
      skipped
    ),
  }
}

export async function listImportPage(container: MedusaContainer): Promise<{
  jobs: ImportJobDTO[]
  categories: CategoryOption[]
}> {
  const service = container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService
  const [jobs, categories] = await Promise.all([
    withCategories(container, service, await service.listRecent()),
    listCategories(container),
  ])

  return { jobs, categories }
}

export async function drain(container: MedusaContainer): Promise<number> {
  let count = 0

  while (await step(container)) {
    count += 1
  }

  return count
}

async function step(container: MedusaContainer): Promise<boolean> {
  const database = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Database
  const claim = await database.transaction(async (trx) => {
    const cutoff = new Date(Date.now() - STALE_MS)

    await trx("kibiimport_job")
      .where("status", "processing")
      .whereNull("deleted_at")
      .andWhere((query) => {
        query.whereNull("started_at").orWhere("started_at", "<", cutoff)
      })
      .update({
        status: "failed",
        exit_code: 1,
        result: "İçe aktarma bitmeden durdu.",
        finished_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      })

    const busy = await trx("kibiimport_job")
      .where("status", "processing")
      .whereNull("deleted_at")
      .where("started_at", ">=", cutoff)
      .forUpdate()
      .first()

    if (busy) {
      return null
    }

    const job = await trx("kibiimport_job")
      .where("status", "pending")
      .whereNull("deleted_at")
      .orderBy("created_at", "asc")
      .forUpdate()
      .first()

    if (!job) {
      return null
    }

    await trx("kibiimport_job")
      .where("id", job.id)
      .update({
        status: "processing",
        started_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      })

    return job
  })

  if (!claim) {
    return false
  }

  const service = container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService

  try {
    const result = await importProduct(container, claim.url, claim.category_id)
    await service.finishJob(claim.id, {
      status: "completed",
      result: renderResult(result),
      exitCode: 0,
    })
  } catch (error) {
    await service.finishJob(claim.id, {
      status: "failed",
      result: messageOf(error),
      exitCode: 1,
    })
  }

  return true
}

async function assertCategory(container: MedusaContainer, categoryId: string): Promise<void> {
  const categories = await listCategories(container)

  if (!categories.some((category) => category.id === categoryId)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Kategori bulunamadı.")
  }
}

async function listCategories(container: MedusaContainer): Promise<CategoryOption[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as Graph
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "parent_category_id", "rank"],
  })

  return categoryPaths(
    data.flatMap((row) => {
      if (typeof row.id !== "string" || typeof row.name !== "string" || !row.name) {
        return []
      }

      return [
        {
          id: row.id,
          name: row.name,
          parentId: typeof row.parent_category_id === "string" ? row.parent_category_id : null,
          rank: typeof row.rank === "number" ? row.rank : 0,
        },
      ]
    })
  )
}

async function withCategories(
  container: MedusaContainer,
  service: KibiimportModuleService,
  rows: Awaited<ReturnType<KibiimportModuleService["listRecent"]>>
): Promise<ImportJobDTO[]> {
  const categories = await listCategories(container)
  const names = new Map(categories.map((category) => [category.id, category.name]))

  return rows.map((row) => service.toJob(row, names.get(row.category_id) ?? null))
}

export function summarize(jobs: ImportJobDTO[], skipped: string[]): ImportSummary {
  const completed = jobs.filter((job) => job.status === "completed").length
  const failed = jobs.filter((job) => job.status === "failed").length
  const queued = jobs.length - completed - failed
  const lines: string[] = []

  if (completed === 1) {
    lines.push("İçe aktarma tamamlandı.")
  } else if (completed > 1) {
    lines.push(`${completed} ürün içe aktarıldı.`)
  }

  if (failed === 1) {
    lines.push("İçe aktarma başarısız oldu.")
  } else if (failed > 1) {
    lines.push(`${failed} ürün içe aktarılamadı.`)
  }

  if (queued === 1) {
    lines.push("Link kuyruğa alındı.")
  } else if (queued > 1) {
    lines.push(`${queued} link kuyruğa alındı.`)
  }

  return { completed, failed, queued, lines, skipped }
}

function messageOf(error: unknown): string {
  if (error instanceof ImportException || error instanceof MedusaError || error instanceof Error) {
    return error.message || "İçe aktarma başarısız oldu."
  }

  return "İçe aktarma başarısız oldu."
}
