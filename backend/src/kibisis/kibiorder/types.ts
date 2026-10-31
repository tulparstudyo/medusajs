export type OrderPaymentStatus =
  | "not_paid"
  | "awaiting"
  | "captured"
  | "partially_refunded"
  | "refunded"
  | "canceled"
  | "requires_action"
  | string

export type OrderFulfillmentStatus =
  | "not_fulfilled"
  | "partially_fulfilled"
  | "fulfilled"
  | "partially_shipped"
  | "shipped"
  | "partially_delivered"
  | "delivered"
  | "canceled"
  | string

export interface FulfillmentLabel {
  id?: string
  tracking_number: string
  tracking_url?: string
  label_url?: string
}

export interface FulfillmentItem {
  id: string
  quantity: number
  line_item_id: string
}

export interface Fulfillment {
  id: string
  provider_id?: string
  shipping_option_id?: string
  data?: Record<string, any>
  tracking_numbers?: string[]
  labels?: FulfillmentLabel[]
  packed_at?: string
  shipped_at?: string
  delivered_at?: string
  canceled_at?: string
  created_at: string
}

export interface OrderItem {
  id: string
  title: string
  subtitle?: string
  thumbnail?: string
  quantity: number
  unit_price: number
  total: number
}

export interface OrderAddress {
  first_name?: string
  last_name?: string
  phone?: string
  address_1?: string
  address_2?: string
  city?: string
  province?: string
  postal_code?: string
  country_code?: string
}

export interface OrderCustomer {
  id: string
  first_name?: string
  last_name?: string
  email: string
  phone?: string
}

export interface OrderDTO {
  id: string
  display_id: number
  status: string
  payment_status?: OrderPaymentStatus
  fulfillment_status?: OrderFulfillmentStatus
  total: number
  subtotal?: number
  tax_total?: number
  shipping_total?: number
  discount_total?: number
  currency_code: string
  email?: string
  customer?: OrderCustomer
  shipping_address?: OrderAddress
  billing_address?: OrderAddress
  fulfillments?: Fulfillment[]
  items?: OrderItem[]
  sales_channel?: {
    id: string
    name: string
  }
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
}

export type OrderFilterTab =
  | "all"
  | "unfulfilled"
  | "fulfilled"
  | "delivered"
  | "awaiting_payment"
  | "refunded"
  | "canceled"

