/**
 * Kibisis payment contract, apiVersion 1. Every payment repository ships an
 * identical copy in its src/contract.ts; change them together and bump the
 * version when a field is removed or its meaning changes.
 */
export const PAYMENT_API_VERSION = 1

export type CredentialField = {
  key: string
  label: string
  secret?: boolean
  required?: boolean
  placeholder?: string
  hint?: string
}

export type PaymentConfig = {
  testMode: boolean
  installmentsEnabled: boolean
  maxInstallments: number
  credentials: Record<string, string>
}

export type PaymentParty = {
  id?: string | null
  name: string
  surname: string
  email: string
  phone: string
  identityNumber?: string | null
  address: string
  city: string
  district?: string | null
  country: string
  postalCode?: string | null
  ip?: string | null
}

export type PaymentBasketItem = {
  id: string
  name: string
  category: string
  price: string
}

export type PaymentSessionRequest = {
  reference: string
  cartId: string
  amount: string
  currency: string
  locale: "tr" | "en"
  callbackUrl: string
  buyer: PaymentParty
  billingAddress: PaymentParty
  shippingAddress: PaymentParty
  basket: PaymentBasketItem[]
}

export type PaymentSessionPresentation =
  | { mode: "iframe"; iframeUrl: string; token?: string | null }
  | { mode: "html"; htmlContent: string; paymentPageUrl?: string | null; token?: string | null }
  | { mode: "redirect"; redirectUrl: string; token?: string | null }

export type PaymentSessionResult = PaymentSessionPresentation & {
  reference: string
  providerReference: string | null
  raw?: Record<string, unknown>
}

export type PaymentCallbackRequest = {
  reference?: string | null
  token?: string | null
  body: Record<string, unknown>
  headers?: Record<string, string | string[] | undefined>
}

export type PaymentVerifyResult = {
  reference: string
  providerReference: string | null
  status: "authorized" | "captured" | "failed" | "pending"
  paidAmount?: string | null
  installment?: number | null
  cardFamily?: string | null
  lastFourDigits?: string | null
  errorMessage?: string | null
  acknowledgmentBody?: string | null
}

export type PaymentRefundRequest = {
  reference: string
  providerReference: string
  amount: string
  currency: string
  ip?: string | null
}

export type PaymentRefundResult = {
  reference: string
  refundReference: string | null
}

export type PaymentDocument = Record<string, unknown>

/** Speaks the gateway's wire protocol and returns raw responses. */
export interface PaymentClient {
  initializeSession(payload: PaymentDocument): Promise<PaymentDocument>
  verifyCallback(payload: PaymentDocument): Promise<PaymentDocument>
  refund?(payload: PaymentDocument): Promise<PaymentDocument>
  cancel?(payload: PaymentDocument): Promise<PaymentDocument>
}

/** Maps shop-neutral payment data to gateway payload and back. */
export interface PaymentAdapter {
  toSession(request: PaymentSessionRequest): PaymentDocument
  fromSession(request: PaymentSessionRequest, response: PaymentDocument): PaymentSessionResult
  toVerify(request: PaymentCallbackRequest): PaymentDocument
  fromVerify(request: PaymentCallbackRequest, response: PaymentDocument): PaymentVerifyResult
  toRefund?(request: PaymentRefundRequest): PaymentDocument
  fromRefund?(request: PaymentRefundRequest, response: PaymentDocument): PaymentRefundResult
}

export type PaymentDefinition = {
  apiVersion: typeof PAYMENT_API_VERSION
  id: string
  product: string
  label: string
  description?: string
  licensed?: boolean
  supportsInstallments?: boolean
  credentials: CredentialField[]
  createClient(config: PaymentConfig): PaymentClient
  adapter: PaymentAdapter
}

export class PaymentError extends Error {
  readonly code: string

  constructor(message: string, code = "payment_error") {
    super(message)
    this.name = "PaymentError"
    this.code = code
  }
}

