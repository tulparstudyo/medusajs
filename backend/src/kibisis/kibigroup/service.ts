import { MedusaError, MedusaService } from "@medusajs/framework/utils"

import GroupProduct from "./models/group-product"
import { AssignGroupInput, GroupCode, GroupMember } from "./types"

type GroupRow = {
  id: string
  product_id: string
  main_code: string
  color: string
  color_hex?: string | null
  position?: number | null
}

const CODE_LIMIT = 20

class KibigroupModuleService extends MedusaService({
  GroupProduct,
}) {
  async findMember(productId: string): Promise<GroupMember | null> {
    const [row] = await this.listGroupProducts({ product_id: productId }, { take: 1 })
    return row ? toMember(row) : null
  }

  async listMembers(mainCode: string): Promise<GroupMember[]> {
    const rows = await this.listGroupProducts(
      { main_code: mainCode },
      { take: 200, order: { position: "ASC", color: "ASC" } }
    )

    return rows.map(toMember)
  }

  async assign(productId: string, input: AssignGroupInput): Promise<GroupMember> {
    const mainCode = input.main_code.trim()
    const color = input.color.trim()
    const colorHex = input.color_hex?.trim() || null
    const position = input.position ?? 0

    const siblings = await this.listGroupProducts({ main_code: mainCode }, { take: 200 })
    const clash = siblings.find(
      (row) => row.product_id !== productId && sameColor(row.color, color)
    )

    if (clash) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Bu grupta ${color} rengi zaten başka bir üründe var.`
      )
    }

    const [existing] = await this.listGroupProducts({ product_id: productId }, { take: 1 })
    const row = existing
      ? await this.updateGroupProducts({
          id: existing.id,
          main_code: mainCode,
          color,
          color_hex: colorHex,
          position,
        })
      : await this.createGroupProducts({
          product_id: productId,
          main_code: mainCode,
          color,
          color_hex: colorHex,
          position,
        })

    return toMember(row)
  }

  async rememberImported(productId: string, mainCode: string, color: string): Promise<void> {
    const existing = await this.findMember(productId)

    if (existing) {
      if (existing.main_code !== mainCode || !sameColor(existing.color, color)) {
        await this.assign(productId, {
          main_code: mainCode,
          color,
          color_hex: existing.color_hex,
          position: existing.position,
        })
      }
      return
    }

    await this.assign(productId, { main_code: mainCode, color })
  }

  async clear(productId: string): Promise<void> {
    const rows = await this.listGroupProducts({ product_id: productId }, { take: 10 })

    if (rows.length) {
      await this.deleteGroupProducts(rows.map((row) => row.id))
    }
  }

  async searchCodes(term: string): Promise<GroupCode[]> {
    const needle = term.trim()
    const rows = await this.listGroupProducts(
      needle ? { main_code: { $ilike: `%${escapeLike(needle)}%` } } : {},
      { take: 500, order: { main_code: "ASC" } }
    )
    const counts = new Map<string, number>()

    for (const row of rows) {
      counts.set(row.main_code, (counts.get(row.main_code) ?? 0) + 1)
    }

    return Array.from(counts, ([main_code, count]) => ({ main_code, count })).slice(
      0,
      CODE_LIMIT
    )
  }
}

function toMember(row: GroupRow): GroupMember {
  return {
    product_id: row.product_id,
    main_code: row.main_code,
    color: row.color,
    color_hex: row.color_hex ?? null,
    position: row.position ?? 0,
  }
}

function sameColor(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase("tr-TR") === right.trim().toLocaleLowerCase("tr-TR")
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export default KibigroupModuleService
