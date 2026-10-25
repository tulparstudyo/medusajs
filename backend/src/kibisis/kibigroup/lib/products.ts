import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, getVariantAvailability } from "@medusajs/framework/utils"

import { AdminGroupItem, GroupMember, StoreGroupItem } from "../types"

type Query = {
  graph: (args: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data: Record<string, unknown>[] }>
}

type VariantRow = {
  id: string
  manage_inventory: boolean
  allow_backorder: boolean
}

function query(container: MedusaContainer): Query {
  return container.resolve(ContainerRegistrationKeys.QUERY) as Query
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function thumbnailOf(row: Record<string, unknown>): string | null {
  const thumbnail = text(row.thumbnail)
  if (thumbnail) {
    return thumbnail
  }

  const images = Array.isArray(row.images) ? row.images : []
  for (const image of images) {
    const url = text((image as { url?: unknown } | null)?.url)
    if (url) {
      return url
    }
  }

  return null
}

function variantsOf(row: Record<string, unknown>): VariantRow[] {
  const variants = Array.isArray(row.variants) ? row.variants : []

  return variants.flatMap((variant) => {
    const record = variant as Record<string, unknown> | null
    const id = text(record?.id)
    if (!id) {
      return []
    }

    return [
      {
        id,
        manage_inventory: record?.manage_inventory !== false,
        allow_backorder: record?.allow_backorder === true,
      },
    ]
  })
}

function channelIdsOf(row: Record<string, unknown>): string[] {
  const channels = Array.isArray(row.sales_channels) ? row.sales_channels : []

  return channels
    .map((channel) => text((channel as { id?: unknown } | null)?.id))
    .filter((id) => id !== "")
}

export async function loadAdminItems(
  container: MedusaContainer,
  members: GroupMember[]
): Promise<AdminGroupItem[]> {
  if (!members.length) {
    return []
  }

  const { data } = await query(container).graph({
    entity: "product",
    fields: ["id", "title", "handle", "status", "thumbnail", "images.url"],
    filters: { id: members.map((member) => member.product_id) },
  })
  const byId = new Map(data.map((row) => [text(row.id), row]))

  return members.flatMap((member) => {
    const row = byId.get(member.product_id)
    if (!row) {
      return []
    }

    return [
      {
        ...member,
        title: text(row.title),
        handle: text(row.handle),
        status: text(row.status),
        thumbnail: thumbnailOf(row),
      },
    ]
  })
}

export async function loadStoreItems(
  container: MedusaContainer,
  members: GroupMember[],
  salesChannelIds: string[]
): Promise<StoreGroupItem[]> {
  if (!members.length || !salesChannelIds.length) {
    return []
  }

  const graph = query(container)
  const { data } = await graph.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "thumbnail",
      "images.url",
      "sales_channels.id",
      "variants.id",
      "variants.manage_inventory",
      "variants.allow_backorder",
    ],
    filters: {
      id: members.map((member) => member.product_id),
      status: "published",
    },
  })

  const allowed = new Set(salesChannelIds)
  const visible = new Map<string, { row: Record<string, unknown>; channelId: string }>()

  for (const row of data) {
    const channelId = channelIdsOf(row).find((id) => allowed.has(id))
    if (channelId) {
      visible.set(text(row.id), { row, channelId })
    }
  }

  const tracked = new Map<string, string[]>()
  for (const { row, channelId } of visible.values()) {
    const ids = variantsOf(row)
      .filter((variant) => variant.manage_inventory && !variant.allow_backorder)
      .map((variant) => variant.id)

    if (ids.length) {
      tracked.set(channelId, [...(tracked.get(channelId) ?? []), ...ids])
    }
  }

  const available = new Map<string, number>()
  for (const [channelId, variantIds] of tracked) {
    const result = await getVariantAvailability(graph as never, {
      variant_ids: variantIds,
      sales_channel_id: channelId,
    })

    for (const [variantId, entry] of Object.entries(result)) {
      available.set(variantId, entry.availability ?? 0)
    }
  }

  return members.flatMap((member) => {
    const entry = visible.get(member.product_id)
    if (!entry) {
      return []
    }

    const inStock = variantsOf(entry.row).some(
      (variant) =>
        !variant.manage_inventory ||
        variant.allow_backorder ||
        (available.get(variant.id) ?? 0) > 0
    )

    return [
      {
        product_id: member.product_id,
        handle: text(entry.row.handle),
        title: text(entry.row.title),
        color: member.color,
        color_hex: member.color_hex,
        thumbnail: thumbnailOf(entry.row),
        in_stock: inStock,
      },
    ]
  })
}
