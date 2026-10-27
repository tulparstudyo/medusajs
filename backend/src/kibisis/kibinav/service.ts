import { MedusaError, MedusaService } from "@medusajs/framework/utils"

import { hasCycle } from "./lib/tree"
import { serializeNavItem } from "./lib/serialize"
import NavItem from "./models/nav-item"
import {
  NavItemDTO,
  NavMenu,
  NormalizedTarget,
  ReorderNavItemInput,
} from "./types"

type CreateMenuItemInput = {
  menu: NavMenu
  label: string
  align: "start" | "end"
  parent_id: string | null
  is_active: boolean
} & NormalizedTarget

type UpdateMenuItemInput = {
  label: string
  align: "start" | "end"
  is_active: boolean
} & NormalizedTarget

class KibinavModuleService extends MedusaService({
  KibinavItem: NavItem,
}) {
  async listMenu(menu: NavMenu): Promise<NavItemDTO[]> {
    const items = await this.listAll({ menu })
    return items.map(serializeNavItem)
  }

  async getMenuItem(id: string): Promise<NavItemDTO> {
    const item = await this.retrieveExisting(id, "Menü öğesi bulunamadı.")
    return serializeNavItem(item)
  }

  async createMenuItem(input: CreateMenuItemInput): Promise<NavItemDTO> {
    if (input.parent_id) {
      const parent = await this.retrieveExisting(input.parent_id, "Üst öğe bulunamadı.")
      if (parent.menu !== input.menu) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Üst öğe aynı menüde olmalıdır."
        )
      }
    }

    const siblings = (await this.listAll({ menu: input.menu })).filter(
      (item) => item.parent_id === input.parent_id
    )
    const position =
      siblings.reduce((max, item) => Math.max(max, item.position), -1) + 1

    const created = await this.createKibinavItems({
      menu: input.menu,
      label: input.label,
      align: input.align,
      parent_id: input.parent_id,
      position,
      target_type: input.target_type,
      category_id: input.category_id,
      url: input.url,
      anchor: input.anchor,
      new_tab: input.new_tab,
      is_active: input.is_active,
    })

    return serializeNavItem(created)
  }

  async updateMenuItem(
    id: string,
    input: UpdateMenuItemInput
  ): Promise<NavItemDTO> {
    await this.retrieveExisting(id, "Menü öğesi bulunamadı.")

    const updated = await this.updateKibinavItems({
      id,
      label: input.label,
      align: input.align,
      target_type: input.target_type,
      category_id: input.category_id,
      url: input.url,
      anchor: input.anchor,
      new_tab: input.new_tab,
      is_active: input.is_active,
    })

    return serializeNavItem(updated)
  }

  async deleteMenuItem(id: string): Promise<void> {
    await this.retrieveExisting(id, "Menü öğesi bulunamadı.")

    const children = await this.listKibinavItems({ parent_id: id }, { take: 1 })
    if (children.length) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "Bu öğenin alt öğeleri var. Önce alt öğeleri silin veya taşıyın."
      )
    }

    await this.deleteKibinavItems(id)
  }

  async reorderMenu(
    menu: NavMenu,
    updates: ReorderNavItemInput[]
  ): Promise<NavItemDTO[]> {
    const existing = await this.listAll({ menu })
    const existingIds = new Set(existing.map((item) => item.id))

    if (updates.length !== existing.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Menü öğelerinin tamamı gönderilmelidir."
      )
    }

    const seen = new Set<string>()
    const parentById = new Map<string, string | null>()

    for (const update of updates) {
      if (!existingIds.has(update.id) || seen.has(update.id)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Menü öğesi bu menüye ait değil veya listede tekrar ediyor."
        )
      }

      seen.add(update.id)

      if (update.parent_id && !existingIds.has(update.parent_id)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Üst öğe bulunamadı."
        )
      }

      parentById.set(update.id, update.parent_id)
    }

    if (hasCycle(parentById)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Bir öğe kendi altına taşınamaz."
      )
    }

    if (updates.length) {
      await this.updateKibinavItems(
        updates.map((update) => ({
          id: update.id,
          parent_id: update.parent_id,
          position: update.position,
        }))
      )
    }

    return this.listMenu(menu)
  }

  async previousOrder(menu: NavMenu): Promise<ReorderNavItemInput[]> {
    const items = await this.listAll({ menu })
    return items.map((item) => ({
      id: item.id,
      parent_id: item.parent_id,
      position: item.position,
    }))
  }

  private async retrieveExisting(id: string, message: string) {
    try {
      return await this.retrieveKibinavItem(id)
    } catch (error) {
      if (
        MedusaError.isMedusaError(error) &&
        error.type === MedusaError.Types.NOT_FOUND
      ) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, message)
      }

      throw error
    }
  }

  private async listAll(filters: { menu: NavMenu }) {
    const pageSize = 200
    const items: Awaited<ReturnType<KibinavModuleService["listKibinavItems"]>> = []
    let skip = 0

    while (skip <= 5000) {
      const page = await this.listKibinavItems(filters, {
        take: pageSize,
        skip,
        order: { position: "ASC" },
      })

      items.push(...page)
      if (page.length < pageSize) {
        break
      }

      skip += pageSize
    }

    return items
  }
}

export default KibinavModuleService
