import { randomUUID } from "crypto"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { ShipmentRequest } from "../kibicarrier/contract"
import { createShipment } from "../kibicarrier/gateway"
import { installedCarriers } from "../kibicarrier/registry"
import { carrierConfig } from "../kibicarrier/settings"
import { KIBISETTINGS_MODULE } from "../kibisettings"
import KibisettingsModuleService from "../kibisettings/service"

export interface OrderShipmentRow {
  id: string
  order_id: string
  carrier_id: string
  carrier_name: string
  kibisis_tracking_code: string
  tracking_code: string | null
  tracking_url: string | null
  barcode: string | null
  status: string
  last_movement_at: string | Date | null
  metadata?: Record<string, any> | null
  created_at: string | Date
  updated_at: string | Date
}

let tableChecked = false

export async function ensureShipmentTable(scope: MedusaContainer): Promise<void> {
  if (tableChecked) return

  const knex = scope.resolve<any>(ContainerRegistrationKeys.PG_CONNECTION)
  if (!knex) return

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS "kibiorder_shipment" (
      "id" text not null,
      "order_id" text not null,
      "carrier_id" text not null,
      "carrier_name" text not null,
      "kibisis_tracking_code" text not null,
      "tracking_code" text null,
      "tracking_url" text null,
      "barcode" text null,
      "status" text not null default 'created',
      "last_movement_at" timestamptz null,
      "metadata" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      constraint "kibiorder_shipment_pkey" primary key ("id")
    );
    CREATE INDEX IF NOT EXISTS "IDX_kibiorder_shipment_order_id" ON "kibiorder_shipment" ("order_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kibiorder_shipment_kibisis_tracking_code_unique" ON "kibiorder_shipment" ("kibisis_tracking_code");
  `)

  tableChecked = true
}

export async function getActiveCarrierInfo(scope: MedusaContainer): Promise<{
  id: string
  label: string
  product: string
} | null> {
  const { carriers } = installedCarriers()
  if (carriers.length === 0) return null

  try {
    const settingsService = scope.resolve<KibisettingsModuleService>(KIBISETTINGS_MODULE)
    const settings = await settingsService.getSecretSettings("carriers")

    for (const carrier of carriers) {
      const config = carrierConfig(carrier.definition, settings)
      if (config.enabled) {
        return {
          id: carrier.id,
          label: carrier.definition.label,
          product: carrier.definition.product,
        }
      }
    }
  } catch {
    // If settings service resolution fails, fallback to first carrier
  }

  // Fallback to first installed carrier
  return {
    id: carriers[0].id,
    label: carriers[0].definition.label,
    product: carriers[0].definition.product,
  }
}

export async function createBulkShipments(
  scope: MedusaContainer,
  orderIds: string[]
): Promise<{
  activeCarrier: string
  processedCount: number
  shipments: OrderShipmentRow[]
  errors: { orderId: string; message: string }[]
}> {
  await ensureShipmentTable(scope)

  const activeCarrier = await getActiveCarrierInfo(scope)
  if (!activeCarrier) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Kurulu veya aktif bir kargo firması bulunamadı. Lütfen Ayarlar > Kargo Firmaları sayfasını kontrol edin."
    )
  }

  const knex = scope.resolve<any>(ContainerRegistrationKeys.PG_CONNECTION)
  const query = scope.resolve<any>(ContainerRegistrationKeys.QUERY)
  const orderModuleService = scope.resolve<any>(Modules.ORDER)

  // Fetch orders with shipping addresses and customer info
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "shipping_address.*",
      "customer.*",
      "items.*",
      "metadata",
    ],
    filters: { id: orderIds },
  })

  const shipments: OrderShipmentRow[] = []
  const errors: { orderId: string; message: string }[] = []

  for (const order of orders) {
    try {
      const shippingAddress = order.shipping_address || {}
      const receiverName =
        [shippingAddress.first_name, shippingAddress.last_name].filter(Boolean).join(" ") ||
        [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") ||
        "Müşteri"

      const receiverPhone = shippingAddress.phone || order.customer?.phone || "05000000000"
      const receiverAddress =
        [shippingAddress.address_1, shippingAddress.address_2].filter(Boolean).join(" ") ||
        "Teslimat Adresi"
      const receiverCity = shippingAddress.city || "İstanbul"
      const receiverDistrict = shippingAddress.province || shippingAddress.city || "Merkez"
      const receiverPostal = shippingAddress.postal_code || null

      const kibisisTrackingCode = `KIBI-${order.display_id}-${Date.now().toString().slice(-4)}`

      const shipmentRequest: ShipmentRequest = {
        reference: kibisisTrackingCode,
        invoiceNumber: String(order.display_id),
        receiver: {
          name: receiverName,
          phone: receiverPhone,
          email: order.email || null,
          address: receiverAddress,
          city: receiverCity,
          district: receiverDistrict,
          postalCode: receiverPostal,
        },
        parcels: 1,
        description: `Sipariş #${order.display_id}`,
      }

      // Call carrier gateway
      const result = await createShipment(scope, activeCarrier.id, shipmentRequest)

      const shipmentId = `kshp_${randomUUID().replace(/-/g, "").slice(0, 24)}`
      const now = new Date()

      const row: OrderShipmentRow = {
        id: shipmentId,
        order_id: order.id,
        carrier_id: activeCarrier.id,
        carrier_name: activeCarrier.label,
        kibisis_tracking_code: kibisisTrackingCode,
        tracking_code: result.trackingNumber,
        tracking_url: result.trackingUrl,
        barcode: result.trackingNumber || kibisisTrackingCode,
        status: "created",
        last_movement_at: now,
        metadata: result as any,
        created_at: now,
        updated_at: now,
      }

      await knex("kibiorder_shipment").insert({
        ...row,
        metadata: JSON.stringify(row.metadata),
      })

      // Update Medusa order metadata with tracking details
      const existingMeta = order.metadata || {}
      await orderModuleService.updateOrders(order.id, {
        metadata: {
          ...existingMeta,
          tracking_number: result.trackingNumber || kibisisTrackingCode,
          carrier: activeCarrier.label,
          carrier_id: activeCarrier.id,
          kibisis_tracking_code: kibisisTrackingCode,
          tracking_url: result.trackingUrl,
        },
      })

      shipments.push(row)
    } catch (err: any) {
      errors.push({
        orderId: order.id,
        message: err.message || "Kargo kaydı açılamadı.",
      })
    }
  }

  return {
    activeCarrier: activeCarrier.label,
    processedCount: shipments.length,
    shipments,
    errors,
  }
}

export async function listOrderShipments(
  scope: MedusaContainer,
  orderId?: string
): Promise<OrderShipmentRow[]> {
  await ensureShipmentTable(scope)

  const knex = scope.resolve<any>(ContainerRegistrationKeys.PG_CONNECTION)
  let query = knex("kibiorder_shipment").orderBy("created_at", "desc")

  if (orderId) {
    query = query.where("order_id", orderId)
  }

  const rows = await query
  return rows.map((r: any) => ({
    ...r,
    metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata,
  }))
}

