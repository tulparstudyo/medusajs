import { AbstractPaymentProvider, MedusaError } from "@medusajs/framework/utils"
import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { defaultCardProviderId, initializePayment, refundPayment } from "./gateway"
import { PaymentParty, PaymentSessionRequest } from "./contract"

type KibipaymentOptions = Record<string, unknown>

type Bag = Record<string, unknown>

function bag(value: unknown): Bag {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Bag) : {}
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

/** Medusa amounts may arrive as numbers or BigNumber-like objects. */
function amountOf(value: unknown): string {
  const raw = bag(value).value ?? value
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00"
}

function shopUrl(): string {
  return (process.env.KIBISIS_SHOP_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
}

/**
 * One Medusa payment provider (pp_kibipayment_default) that routes card
 * payments to the installed Kibisis payment packages and also serves the
 * built-in bank transfer and cash on delivery methods.
 *
 * The provider runs in the Payment Module's isolated container, so settings
 * are read through the kibisettings bridge rather than the container.
 */
export class KibipaymentProviderService extends AbstractPaymentProvider<KibipaymentOptions> {
  static identifier = "kibipayment"

  constructor(cradle: Record<string, unknown>, options: KibipaymentOptions = {}) {
    super(cradle, options)
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const data = bag(input.data)
    const method = str(data.method, "card")
    const amount = amountOf(input.amount)
    const currency = str(input.currency_code, "try").toUpperCase()

    if (method === "bank_transfer" || method === "cod") {
      return {
        id: `${method}_${Date.now()}`,
        data: { method, status: "pending", amount, currency_code: currency },
      }
    }

    const requested = str(data.provider_id)
    const providerId = requested && requested !== "card" ? requested : await defaultCardProviderId()

    if (!providerId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Aktif bir kredi kartı ödeme paketi yok. Yönetim panelinde Site Ayarları > Ödeme Ayarları'ndan bir paketi açın."
      )
    }

    const context = bag(input.context)
    const customer = bag(context.customer)
    const address = bag(data.billing_address)
    const cartId = str(data.cart_id)
    const reference = cartId || `kp_${Date.now()}`
    const storefrontUrl = str(data.storefront_url)
    const storefrontParam = storefrontUrl ? `&storefront=${encodeURIComponent(storefrontUrl)}` : ""

    const buyer: PaymentParty = {
      id: str(customer.id, reference),
      name: str(address.first_name, str(customer.first_name, "Müşteri")),
      surname: str(address.last_name, str(customer.last_name, "Müşteri")),
      email: str(data.email, str(customer.email, "musteri@example.com")),
      phone: str(address.phone, str(customer.phone, "+905555555555")),
      address: str(address.address_1, "Adres"),
      city: str(address.city, "İstanbul"),
      country: str(address.country_code, "tr").toUpperCase(),
      postalCode: str(address.postal_code, "34000"),
      ip: str(data.ip, "127.0.0.1"),
    }

    const request: PaymentSessionRequest = {
      reference,
      cartId,
      amount,
      currency,
      locale: "tr",
      callbackUrl: `${shopUrl()}/kibipayment/callback?provider=${encodeURIComponent(providerId)}&reference=${encodeURIComponent(reference)}&cart_id=${encodeURIComponent(cartId)}${storefrontParam}`,
      buyer,
      billingAddress: buyer,
      shippingAddress: buyer,
      basket: [{ id: reference, name: "Sipariş", category: "Genel", price: amount }],
    }

    const session = await initializePayment(providerId, request)

    return {
      id: session.providerReference || session.reference,
      data: {
        method: "card",
        provider_id: providerId,
        reference: session.reference,
        provider_reference: session.providerReference,
        status: "pending",
        presentation: {
          mode: session.mode,
          token: session.token ?? null,
          iframeUrl: session.mode === "iframe" ? session.iframeUrl : null,
          htmlContent: session.mode === "html" ? session.htmlContent : null,
          paymentPageUrl: session.mode === "html" ? session.paymentPageUrl ?? null : null,
          redirectUrl: session.mode === "redirect" ? session.redirectUrl : null,
        },
      },
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = bag(input.data)
    const status = data.status === "captured" ? "captured" : "authorized"

    return { status, data: { ...data, status } }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: { ...bag(input.data), captured: true } }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = bag(input.data)
    const providerId = str(data.provider_id)

    if (data.method === "card" && providerId) {
      const refund = await refundPayment(providerId, {
        reference: str(data.reference),
        providerReference: str(data.provider_reference, str(data.reference)),
        amount: amountOf(input.amount),
        currency: str(data.currency_code, "TRY"),
      })
      return { data: { ...data, refund } }
    }

    return { data: { ...data, refunded: true } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: { ...bag(input.data), cancelled: true } }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: bag(input.data) }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const status = bag(input.data).status
    return { status: status === "captured" ? "captured" : status === "authorized" ? "authorized" : "pending" }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: bag(input.data) }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: { ...bag(input.data), amount: amountOf(input.amount) } }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const data = bag(payload.data)
    return {
      action: "not_supported",
      data: { session_id: str(data.session_id), amount: Number(data.amount ?? 0) },
    }
  }
}
