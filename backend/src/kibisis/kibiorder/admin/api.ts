import { OrderDTO } from "../types"

export interface TrackingDetail {
  trackingNumber: string
  trackingUrl: string | null
  carrierLabel: string
}

export function extractTrackingDetails(order: OrderDTO): TrackingDetail[] {
  const details: TrackingDetail[] = []

  // 1. Check fulfillments array
  if (order.fulfillments && Array.isArray(order.fulfillments)) {
    for (const ful of order.fulfillments) {
      if (ful.canceled_at) continue

      let carrier = "Kargo"
      const providerId = (ful.provider_id || "").toLowerCase()
      if (providerId.includes("yurtici")) carrier = "Yurtiçi Kargo"
      else if (providerId.includes("aras")) carrier = "Aras Kargo"
      else if (providerId.includes("mng")) carrier = "MNG Kargo"
      else if (providerId.includes("surat")) carrier = "Sürat Kargo"
      else if (providerId.includes("ptt")) carrier = "PTT Kargo"
      else if (providerId.includes("hepsijet")) carrier = "HepsiJET"
      else if (providerId.includes("trendyol")) carrier = "Trendyol Express"

      // From labels
      if (ful.labels && Array.isArray(ful.labels)) {
        for (const label of ful.labels) {
          if (label.tracking_number) {
            details.push({
              trackingNumber: label.tracking_number,
              trackingUrl: label.tracking_url || buildTrackingUrl(carrier, label.tracking_number),
              carrierLabel: carrier,
            })
          }
        }
      }

      // From tracking_numbers array
      if (ful.tracking_numbers && Array.isArray(ful.tracking_numbers)) {
        for (const num of ful.tracking_numbers) {
          if (num && !details.some((d) => d.trackingNumber === num)) {
            details.push({
              trackingNumber: num,
              trackingUrl: buildTrackingUrl(carrier, num),
              carrierLabel: carrier,
            })
          }
        }
      }
    }
  }

  // 2. Check metadata fallback
  if (details.length === 0 && order.metadata) {
    const metaTracking =
      order.metadata.tracking_number ||
      order.metadata.tracking_code ||
      order.metadata.kargo_takip_no
    const metaCarrier =
      order.metadata.carrier ||
      order.metadata.carrier_name ||
      order.metadata.kargo_firmasi ||
      "Kargo"

    if (metaTracking) {
      const code = String(metaTracking)
      details.push({
        trackingNumber: code,
        trackingUrl:
          order.metadata.tracking_url || buildTrackingUrl(String(metaCarrier), code),
        carrierLabel: String(metaCarrier),
      })
    }
  }

  return details
}

export function buildTrackingUrl(carrier: string, trackingNumber: string): string | null {
  const norm = carrier.toLowerCase()
  const code = encodeURIComponent(trackingNumber.trim())

  if (norm.includes("yurti")) {
    return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${code}`
  }
  if (norm.includes("aras")) {
    return `https://www.araskargo.com.tr/kargotakip?kod=${code}`
  }
  if (norm.includes("mng")) {
    return `https://kargotakip.mngkargo.com.tr/?takipNo=${code}`
  }
  if (norm.includes("surat") || norm.includes("sürat")) {
    return `https://suratkargo.com.tr/KargoTakip/?kargotakipno=${code}`
  }
  if (norm.includes("ptt")) {
    return `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${code}`
  }
  if (norm.includes("hepsijet")) {
    return `https://hepsijet.com/gonderi-takip/${code}`
  }

  return null
}

export function formatPrice(amount: number = 0, currencyCode: string = "TRY"): string {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currencyCode.toUpperCase()}`
  }
}

export function formatDate(dateString?: string): string {
  if (!dateString) return "-"
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  } catch {
    return dateString
  }
}

export interface FetchOrdersParams {
  limit?: number
  offset?: number
  status?: string
  fulfillment_status?: string
  payment_status?: string
  q?: string
}

export async function fetchOrders(params: FetchOrdersParams = {}): Promise<{
  orders: OrderDTO[]
  count: number
  limit: number
  offset: number
}> {
  const search = new URLSearchParams()
  search.set("limit", String(params.limit ?? 15))
  search.set("offset", String(params.offset ?? 0))
  search.set(
    "fields",
    "id,display_id,status,payment_status,fulfillment_status,total,currency_code,email,created_at,updated_at,*customer,*shipping_address,*sales_channel,*fulfillments.labels,*fulfillments.tracking_numbers,*items"
  )

  if (params.q) {
    search.set("q", params.q)
  }

  if (params.status) {
    search.set("status", params.status)
  }

  const response = await fetch(`/admin/orders?${search.toString()}`, {
    headers: {
      accept: "application/json",
    },
    credentials: "include",
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: "Siparişler yüklenemedi." }))
    throw new Error(err.message || "Siparişler yüklenemedi.")
  }

  return response.json()
}

export async function fetchOrderById(id: string): Promise<OrderDTO> {
  const search = new URLSearchParams()
  search.set(
    "fields",
    "id,display_id,status,payment_status,fulfillment_status,total,subtotal,tax_total,shipping_total,discount_total,currency_code,email,created_at,updated_at,*customer,*shipping_address,*billing_address,*sales_channel,*fulfillments.labels,*fulfillments.tracking_numbers,*items"
  )

  const response = await fetch(`/admin/orders/${id}?${search.toString()}`, {
    headers: {
      accept: "application/json",
    },
    credentials: "include",
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: "Sipariş yüklenemedi." }))
    throw new Error(err.message || "Sipariş yüklenemedi.")
  }

  const data = await response.json()
  return data.order
}

export async function fetchActiveCarrier(): Promise<{ id: string; label: string } | null> {
  const response = await fetch("/admin/kibiorder/active-carrier", {
    headers: { accept: "application/json" },
    credentials: "include",
  })
  if (!response.ok) return null
  const data = await response.json()
  return data.activeCarrier || null
}

export async function createBulkShipmentsApi(orderIds: string[]): Promise<{
  activeCarrier: string
  processedCount: number
  shipments: any[]
  errors: { orderId: string; message: string }[]
}> {
  const response = await fetch("/admin/kibiorder/shipments", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ order_ids: orderIds }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || "Toplu kargo kaydı oluşturulamadı.")
  }

  return data
}

export async function fetchOrderShipments(orderId?: string): Promise<any[]> {
  const url = orderId
    ? `/admin/kibiorder/shipments?order_id=${encodeURIComponent(orderId)}`
    : "/admin/kibiorder/shipments"

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    credentials: "include",
  })

  if (!response.ok) return []
  const data = await response.json()
  return data.shipments || []
}


