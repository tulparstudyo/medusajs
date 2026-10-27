import { MedusaService } from "@medusajs/framework/utils"

import ImportJob from "./models/import-job"
import ImportProduct from "./models/import-product"
import { ImportJobDTO, ImportStatus, isImportStatus } from "./types"

type JobRow = {
  id: string
  url: string
  category_id: string
  location_ids?: unknown
  currency_code?: string | null
  parent_id?: string | null
  status: string
  result?: string | null
  exit_code?: number | null
  started_at?: Date | string | null
  finished_at?: Date | string | null
  created_at?: Date | string | null
}

type ProductLink = {
  id: string
  source: string
  code: string
  color: string
  product_id: string
}

const RESULT_LIMIT = 65000
const RECENT_LIMIT = 8

class KibiimportModuleService extends MedusaService({
  ImportJob,
  ImportProduct,
}) {
  async listRecent(): Promise<JobRow[]> {
    return await this.listImportJobs(
      {},
      {
        take: RECENT_LIMIT,
        order: { created_at: "DESC" },
      }
    )
  }

  async listByIds(ids: string[]): Promise<JobRow[]> {
    if (!ids.length) {
      return []
    }

    return await this.listImportJobs({ id: ids })
  }

  async listChildren(parentIds: string[]): Promise<JobRow[]> {
    if (!parentIds.length) {
      return []
    }

    return await this.listImportJobs({ parent_id: parentIds })
  }

  async listWaiting(): Promise<JobRow[]> {
    return await this.listImportJobs({ status: ["pending", "processing"] })
  }

  async createPending(input: {
    url: string
    category_id: string
    location_ids: string[]
    currency_code: string | null
    parent_id?: string | null
  }): Promise<JobRow> {
    return await this.createImportJobs({
      url: input.url,
      category_id: input.category_id,
      location_ids: input.location_ids,
      currency_code: input.currency_code,
      parent_id: input.parent_id ?? null,
      status: "pending",
    })
  }

  async finishJob(
    id: string,
    input: { status: Extract<ImportStatus, "completed" | "failed">; result: string; exitCode: number }
  ): Promise<void> {
    await this.updateImportJobs({
      id,
      status: input.status,
      result: clip(input.result),
      exit_code: input.exitCode,
      finished_at: new Date(),
    })
  }

  async findProductLink(code: string, color: string): Promise<ProductLink | null> {
    const [row] = await this.listImportProducts({ code, color }, { take: 1 })
    return row ?? null
  }

  async findProductLinkByProduct(productId: string): Promise<ProductLink | null> {
    const [row] = await this.listImportProducts({ product_id: productId }, { take: 1 })
    return row ?? null
  }

  async rememberProduct(input: {
    source: string
    code: string
    color: string
    product_id: string
  }): Promise<void> {
    const byCode = await this.findProductLink(input.code, input.color)

    if (byCode) {
      if (byCode.product_id !== input.product_id || byCode.source !== input.source) {
        await this.updateImportProducts({
          id: byCode.id,
          source: input.source,
          product_id: input.product_id,
        })
      }

      return
    }

    const byProduct = await this.findProductLinkByProduct(input.product_id)

    if (byProduct) {
      await this.updateImportProducts({
        id: byProduct.id,
        source: input.source,
        code: input.code,
        color: input.color,
        product_id: input.product_id,
      })
      return
    }

    await this.createImportProducts(input)
  }

  toJob(
    row: JobRow,
    categoryName: string | null,
    locationNames: Map<string, string> = new Map()
  ): ImportJobDTO {
    const locationIds = locationIdsOf(row.location_ids)

    return {
      id: row.id,
      url: row.url,
      category_id: row.category_id,
      category_name: categoryName,
      location_ids: locationIds,
      location_names: locationIds.map((id) => locationNames.get(id) ?? id),
      currency_code: row.currency_code ?? null,
      parent_id: row.parent_id ?? null,
      status: isImportStatus(row.status) ? row.status : "pending",
      result: row.result ?? null,
      exit_code: row.exit_code ?? null,
      started_at: iso(row.started_at),
      finished_at: iso(row.finished_at),
      created_at: iso(row.created_at),
    }
  }
}

export function locationIdsOf(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.filter((id): id is string => typeof id === "string" && id !== ""))]
}

function clip(value: string): string {
  const text = value.trim()

  return text.length > RESULT_LIMIT ? text.slice(0, RESULT_LIMIT) : text
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export default KibiimportModuleService
