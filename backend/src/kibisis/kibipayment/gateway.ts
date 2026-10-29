import { MedusaError } from "@medusajs/framework/utils"

import {
  PaymentCallbackRequest,
  PaymentClient,
  PaymentRefundRequest,
  PaymentRefundResult,
  PaymentSessionRequest,
  PaymentSessionResult,
  PaymentVerifyResult,
} from "./contract"
import { findProvider, installedProviders, InstalledPaymentProvider, resolveProviderLicense } from "./registry"
import { paymentField, paymentProviderConfig } from "./settings"
import { kibisettingsService } from "../kibisettings/bridge"

type Session = {
  provider: InstalledPaymentProvider
  client: PaymentClient
}

const UNAVAILABLE_CODES = ["network_error", "invalid_response"]

function isPaymentError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && error.name === "PaymentError"
}

async function guard<T>(run: () => T | Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (isPaymentError(error)) {
      const type = UNAVAILABLE_CODES.includes(error.code ?? "")
        ? MedusaError.Types.UNEXPECTED_STATE
        : MedusaError.Types.INVALID_DATA
      throw new MedusaError(type, error.message)
    }

    throw error
  }
}

/** Payment settings including secrets, read through the kibisettings bridge. */
export async function readPaymentSettings(): Promise<Record<string, unknown>> {
  const service = kibisettingsService()

  if (!service) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Site ayarları modülü henüz yüklenmedi.")
  }

  return (await service.getSecretSettings("payment")) as unknown as Record<string, unknown>
}

/** First installed card provider that is enabled in the settings. */
export async function defaultCardProviderId(): Promise<string | null> {
  const settings = await readPaymentSettings()
  const active = installedProviders().providers.find(
    (provider) => settings[paymentField(provider.id, "enabled")] === true
  )

  return active?.id ?? null
}

export async function openPaymentSession(id: string): Promise<Session> {
  const provider = findProvider(id)

  if (!provider) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `"${id}" ödeme paketi kurulu değil.`)
  }

  const { definition } = provider
  const license = await resolveProviderLicense(provider)

  if (!license.valid) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `${definition.label}: ${license.reason}`)
  }

  const { enabled, config } = paymentProviderConfig(definition, await readPaymentSettings())

  if (!enabled) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `${definition.label} ayarlarda kapalı.`)
  }

  const client = await guard(() => definition.createClient(config))

  return { provider, client }
}

export async function initializePayment(
  providerId: string,
  request: PaymentSessionRequest
): Promise<PaymentSessionResult> {
  const { provider, client } = await openPaymentSession(providerId)
  const { adapter } = provider.definition

  return guard(async () => {
    const rawResponse = await client.initializeSession(adapter.toSession(request))
    return adapter.fromSession(request, rawResponse)
  })
}

export async function verifyPaymentCallback(
  providerId: string,
  request: PaymentCallbackRequest
): Promise<PaymentVerifyResult> {
  const { provider, client } = await openPaymentSession(providerId)
  const { adapter } = provider.definition

  return guard(async () => {
    const rawResponse = await client.verifyCallback(adapter.toVerify(request))
    return adapter.fromVerify(request, rawResponse)
  })
}

export async function refundPayment(
  providerId: string,
  request: PaymentRefundRequest
): Promise<PaymentRefundResult> {
  const { provider, client } = await openPaymentSession(providerId)
  const { adapter } = provider.definition

  if (!client.refund || !adapter.toRefund || !adapter.fromRefund) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `${provider.definition.label} iade fonksiyonunu desteklemiyor.`)
  }

  const refund = client.refund.bind(client)
  const toRefund = adapter.toRefund.bind(adapter)
  const fromRefund = adapter.fromRefund.bind(adapter)

  return guard(async () => fromRefund(request, await refund(toRefund(request))))
}
