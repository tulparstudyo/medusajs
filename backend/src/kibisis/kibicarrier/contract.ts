/**
 * Kibisis carrier contract, apiVersion 1. Every carrier repository ships an
 * identical copy in its src/contract.ts; change them together and bump the
 * version when a field is removed or its meaning changes. The installer
 * transpiles carrier sources one file at a time, so they cannot rely on
 * const enums or other cross-file type information.
 */
export const CARRIER_API_VERSION = 1

export type CredentialField = {
  key: string
  label: string
  secret?: boolean
  required?: boolean
  placeholder?: string
  hint?: string
}

export type CarrierConfig = {
  testMode: boolean
  credentials: Record<string, string>
}

export type ShipmentParty = {
  name: string
  phone: string
  email?: string | null
  address: string
  city: string
  district: string
  postalCode?: string | null
}

export type ShipmentRequest = {
  reference: string
  invoiceNumber?: string | null
  receiver: ShipmentParty
  parcels: number
  weightKg?: number | null
  description?: string | null
  cashOnDelivery?: { amount: string; currency: string } | null
}

export type ShipmentResult = {
  reference: string
  trackingNumber: string | null
  trackingUrl: string | null
}

export type TrackingStatus =
  | "created"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled"
  | "unknown"

export type TrackingEvent = {
  at: string | null
  description: string
  location: string | null
}

export type TrackingResult = {
  reference: string
  status: TrackingStatus
  trackingNumber: string | null
  trackingUrl: string | null
  events: TrackingEvent[]
}

export type CarrierDocument = Record<string, unknown>

/** Speaks the carrier's wire protocol and returns its raw documents. */
export interface CarrierClient {
  createShipment(payload: CarrierDocument): Promise<CarrierDocument>
  cancelShipment(payload: CarrierDocument): Promise<CarrierDocument>
  queryShipment(payload: CarrierDocument): Promise<CarrierDocument>
}

/** Maps shop-neutral shipments to the carrier's documents and back. */
export interface CarrierAdapter {
  toShipment(request: ShipmentRequest): CarrierDocument
  fromShipment(request: ShipmentRequest, response: CarrierDocument): ShipmentResult
  toCancel(reference: string): CarrierDocument
  fromCancel(reference: string, response: CarrierDocument): void
  toQuery(reference: string): CarrierDocument
  fromQuery(reference: string, response: CarrierDocument): TrackingResult
}

export type CarrierDefinition = {
  apiVersion: typeof CARRIER_API_VERSION
  id: string
  product: string
  label: string
  description?: string
  credentials: CredentialField[]
  trackingUrl: string
  createClient(config: CarrierConfig): CarrierClient
  adapter: CarrierAdapter
}

export class CarrierError extends Error {
  readonly code: string

  constructor(message: string, code = "carrier_error") {
    super(message)
    this.name = "CarrierError"
    this.code = code
  }
}
