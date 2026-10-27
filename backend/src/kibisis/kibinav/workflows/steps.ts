import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { KIBINAV_MODULE } from ".."
import { normalizeTarget } from "../lib/normalize"
import KibinavModuleService from "../service"
import {
  CreateNavItemInput,
  NavItemDTO,
  ReorderNavInput,
  UpdateNavItemInput,
} from "../types"

type QueryService = {
  graph: (args: {
    entity: string
    fields: string[]
    filters: Record<string, unknown>
  }) => Promise<{ data: { id: string; handle?: string }[] }>
}

const serviceOf = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(KIBINAV_MODULE) as KibinavModuleService

async function assertCategory(
  container: { resolve: (key: string) => unknown },
  categoryId: string
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryService
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id"],
    filters: { id: categoryId },
  })

  if (!data?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Kategori bulunamadı."
    )
  }
}

export const createNavItemStep = createStep(
  "create-nav-item",
  async (input: CreateNavItemInput, { container }) => {
    const target = normalizeTarget(input)
    if (target.target_type === "category" && target.category_id) {
      await assertCategory(container, target.category_id)
    }

    const item = await serviceOf(container).createMenuItem({
      menu: input.menu,
      label: input.label.trim(),
      align: input.align === "end" ? "end" : "start",
      parent_id: input.parent_id ?? null,
      is_active: input.is_active ?? true,
      ...target,
    })

    return new StepResponse(item, item.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    await serviceOf(container).deleteKibinavItems(id)
  }
)

export const updateNavItemStep = createStep(
  "update-nav-item",
  async (
    input: { id: string; data: UpdateNavItemInput },
    { container }
  ) => {
    const service = serviceOf(container)
    const previous = await service.getMenuItem(input.id)
    const target = normalizeTarget(input.data)

    if (target.target_type === "category" && target.category_id) {
      await assertCategory(container, target.category_id)
    }

    const item = await service.updateMenuItem(input.id, {
      label: input.data.label.trim(),
      align: input.data.align === "end" ? "end" : "start",
      is_active: input.data.is_active ?? previous.is_active,
      ...target,
    })

    return new StepResponse(item, previous)
  },
  async (previous: NavItemDTO | undefined, { container }) => {
    if (!previous) {
      return
    }

    await serviceOf(container).updateKibinavItems({
      id: previous.id,
      label: previous.label,
      align: previous.align,
      target_type: previous.target_type,
      category_id: previous.category_id,
      url: previous.url,
      anchor: previous.anchor,
      new_tab: previous.new_tab,
      is_active: previous.is_active,
    })
  }
)

export const deleteNavItemStep = createStep(
  "delete-nav-item",
  async (id: string, { container }) => {
    const service = serviceOf(container)
    const previous = await service.getMenuItem(id)
    await service.deleteMenuItem(id)
    return new StepResponse({ id }, previous)
  },
  async (previous: NavItemDTO | undefined, { container }) => {
    if (!previous) {
      return
    }

    await serviceOf(container).restoreKibinavItems([previous.id])
  }
)

export const reorderNavStep = createStep(
  "reorder-nav",
  async (input: ReorderNavInput, { container }) => {
    const service = serviceOf(container)
    const previous = await service.previousOrder(input.menu)
    const items = await service.reorderMenu(input.menu, input.items)
    return new StepResponse(items, { menu: input.menu, items: previous })
  },
  async (
    previous:
      | { menu: ReorderNavInput["menu"]; items: ReorderNavInput["items"] }
      | undefined,
    { container }
  ) => {
    if (!previous?.items.length) {
      return
    }

    await serviceOf(container).updateKibinavItems(
      previous.items.map((item) => ({
        id: item.id,
        parent_id: item.parent_id,
        position: item.position,
      }))
    )
  }
)
