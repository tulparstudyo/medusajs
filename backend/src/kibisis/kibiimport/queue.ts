import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

import { HttpStatusException, ImportException } from "./errors"
import { importProduct, renderResult } from "./importer"
import { KIBIIMPORT_MODULE } from "./index"
import { categoryPaths } from "./lib/categories"
import { splitProductUrls } from "./lib/urls"
import { SourceRegistry } from "./registry"
import KibiimportModuleService, { locationIdsOf } from "./service"
import {
  CategoryOption,
  CurrencyOption,
  ImportJobDTO,
  ImportSummary,
  LocationOption,
} from "./types"

const STALE_MS = 10 * 60 * 1000
const JOB_GAP_MS = 1000
const HTTP_FAILURE_GAP_MS = 2000

type JobClaim = {
  id: string
  url: string
  category_id: string
  location_ids: unknown
  currency_code: string | null
  parent_id: string | null
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
    data: {
      id?: string
      name?: string
      parent_category_id?: string | null
      rank?: number | null
      supported_currencies?: { currency_code?: string; is_default?: boolean }[] | null
    }[]
  }>
}

export async function queueAndDrain(
  container: MedusaContainer,
  input: { urls: string; category_id: string; location_ids?: string[]; currency_code?: string }
): Promise<{ jobs: ImportJobDTO[]; summary: ImportSummary }> {
  const service = container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService
  const locationIds = locationIdsOf(input.location_ids ?? [])
  await assertCategory(container, input.category_id)
  await assertLocations(container, locationIds)
  const currencyCode = await resolveCurrency(container, input.currency_code)

  const urls = splitProductUrls(input.urls)

  if (!urls.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "En az bir ürün linki girin.")
  }

  const created: { id: string }[] = []
  const skipped: string[] = []
  const registry = new SourceRegistry()
  const seen = await waitingKeys(service, registry)

  for (const url of urls) {
    try {
      registry.match(url)
    } catch (error) {
      skipped.push(`${url} — ${messageOf(error)}`)
      continue
    }

    const key = registry.key(url)

    if (seen.has(key)) {
      skipped.push(`${url} — Bu link zaten kuyrukta.`)
      continue
    }

    seen.add(key)
    created.push(
      await service.createPending({
        url,
        category_id: input.category_id,
        location_ids: locationIds,
        currency_code: currencyCode,
      })
    )
  }

  if (!created.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, skipped.join(" "))
  }

  await drain(container)

  const createdIds = created.map((job) => job.id)
  const [fresh, finished, colors] = await Promise.all([
    service.listRecent(),
    service.listByIds(createdIds),
    service.listChildren(createdIds),
  ])
  const jobs = await withCategories(container, service, fresh)

  return {
    jobs,
    summary: summarize(
      [...finished, ...colors].map((job) => service.toJob(job, null)),
      skipped
    ),
  }
}

export async function listImportPage(container: MedusaContainer): Promise<{
  jobs: ImportJobDTO[]
  categories: CategoryOption[]
  locations: LocationOption[]
  currencies: CurrencyOption[]
}> {
  const service = container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService
  const [jobs, categories, locations, currencies] = await Promise.all([
    withCategories(container, service, await service.listRecent()),
    listCategories(container),
    listLocations(container),
    listCurrencies(container),
  ])

  return { jobs, categories, locations, currencies }
}

/**
 * Drain runs pending jobs one after another and pauses between two jobs so
 * the source shop receives at most one product request per second. While
 * the source keeps answering with an unsuccessful HTTP status, every such
 * failure in a row makes the next pause two seconds longer (2, 4, 6...).
 */
export async function drain(container: MedusaContainer): Promise<number> {
  let count = 0
  let httpFailures = 0

  while (true) {
    const delayMs =
      count === 0 ? 0 : httpFailures > 0 ? HTTP_FAILURE_GAP_MS * httpFailures : JOB_GAP_MS
    const outcome = await step(container, delayMs)

    if (!outcome) {
      return count
    }

    count += 1
    httpFailures = outcome === "http_failed" ? httpFailures + 1 : 0
  }
}

async function step(
  container: MedusaContainer,
  delayMs: number
): Promise<"completed" | "failed" | "http_failed" | null> {
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
    return null
  }

  const service = container.resolve(KIBIIMPORT_MODULE) as KibiimportModuleService

  if (delayMs > 0) {
    await wait(delayMs)
  }

  try {
    const result = await importProduct(
      container,
      claim.url,
      claim.category_id,
      locationIdsOf(claim.location_ids),
      claim.currency_code
    )
    const colors = claim.parent_id ? null : await queueColors(service, claim, result.colorUrls)
    await service.finishJob(claim.id, {
      status: "completed",
      result: colors ? `${renderResult(result)}\n${colors}` : renderResult(result),
      exitCode: 0,
    })
    return "completed"
  } catch (error) {
    await service.finishJob(claim.id, {
      status: "failed",
      result: messageOf(error),
      exitCode: 1,
    })
    return error instanceof HttpStatusException ? "http_failed" : "failed"
  }
}

/**
 * QueueColors adds the other colours of an imported product to the queue.
 * Colour jobs carry their parent id and do not queue colours again, so a
 * product group is walked once per link the user entered.
 */
async function queueColors(
  service: KibiimportModuleService,
  claim: JobClaim,
  urls: string[]
): Promise<string> {
  if (!urls.length) {
    return "Renk seçenekleri: başka renk yok."
  }

  try {
    const registry = new SourceRegistry()
    const seen = await waitingKeys(service, registry)
    let queued = 0

    for (const url of urls) {
      const key = registry.key(url)

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      await service.createPending({
        url,
        category_id: claim.category_id,
        location_ids: locationIdsOf(claim.location_ids),
        currency_code: claim.currency_code,
        parent_id: claim.id,
      })
      queued += 1
    }

    const waiting = urls.length - queued

    return waiting
      ? `Renk seçenekleri: ${queued} link kuyruğa alındı, ${waiting} link zaten kuyrukta.`
      : `Renk seçenekleri: ${queued} link kuyruğa alındı.`
  } catch (error) {
    return `Renk seçenekleri kuyruğa alınamadı: ${messageOf(error)}`
  }
}

async function waitingKeys(
  service: KibiimportModuleService,
  registry: SourceRegistry
): Promise<Set<string>> {
  return new Set((await service.listWaiting()).map((job) => registry.key(job.url)))
}

async function assertCategory(container: MedusaContainer, categoryId: string): Promise<void> {
  const categories = await listCategories(container)

  if (!categories.some((category) => category.id === categoryId)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Kategori bulunamadı.")
  }
}

async function assertLocations(container: MedusaContainer, locationIds: string[]): Promise<void> {
  if (!locationIds.length) {
    return
  }

  const known = new Set((await listLocations(container)).map((location) => location.id))

  if (locationIds.some((id) => !known.has(id))) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Stok lokasyonu bulunamadı.")
  }
}

async function resolveCurrency(
  container: MedusaContainer,
  code: string | undefined
): Promise<string> {
  const currencies = await listCurrencies(container)
  const chosen = code
    ? currencies.find((currency) => currency.code === code.toLowerCase())
    : currencies.find((currency) => currency.is_default) ?? currencies[0]

  if (!chosen) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Para birimi mağazada tanımlı değil.")
  }

  return chosen.code
}

export async function listCurrencies(container: MedusaContainer): Promise<CurrencyOption[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as Graph
  const { data } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code", "supported_currencies.is_default"],
  })
  const options = new Map<string, CurrencyOption>()

  for (const currency of data.flatMap((store) => store.supported_currencies ?? [])) {
    const code = currency?.currency_code?.toLowerCase()

    if (code && !options.has(code)) {
      options.set(code, { code, is_default: currency.is_default === true })
    }
  }

  return [...options.values()].sort(
    (left, right) => Number(right.is_default) - Number(left.is_default)
  )
}

export async function listLocations(container: MedusaContainer): Promise<LocationOption[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as Graph
  const { data } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })

  return data
    .flatMap((row) =>
      typeof row.id === "string" && typeof row.name === "string" && row.name
        ? [{ id: row.id, name: row.name }]
        : []
    )
    .sort((left, right) => left.name.localeCompare(right.name, "tr"))
}

export async function listCategories(container: MedusaContainer): Promise<CategoryOption[]> {
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
  const [categories, locations] = await Promise.all([
    listCategories(container),
    listLocations(container),
  ])
  const names = new Map(categories.map((category) => [category.id, category.name]))
  const locationNames = new Map(locations.map((location) => [location.id, location.name]))

  return rows.map((row) =>
    service.toJob(row, names.get(row.category_id) ?? null, locationNames)
  )
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function messageOf(error: unknown): string {
  if (error instanceof ImportException || error instanceof MedusaError || error instanceof Error) {
    return error.message || "İçe aktarma başarısız oldu."
  }

  return "İçe aktarma başarısız oldu."
}
