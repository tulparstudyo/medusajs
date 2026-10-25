import { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"

import { CarrierClient, ShipmentRequest, ShipmentResult, TrackingResult } from "./contract"
import { licenseStatus } from "./license"
import { findCarrier, InstalledCarrier } from "./registry"
import { carrierConfig } from "./settings"
import { KIBISETTINGS_MODULE } from "../kibisettings"
import KibisettingsModuleService from "../kibisettings/service"

type Session = {
  carrier: InstalledCarrier
  client: CarrierClient
  trackingUrl: string
}

const UNAVAILABLE_CODES = ["network_error", "invalid_response"]

function isCarrierError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && error.name === "CarrierError"
}

async function guard<T>(run: () => T | Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (isCarrierError(error)) {
      const type = UNAVAILABLE_CODES.includes(error.code ?? "")
        ? MedusaError.Types.UNEXPECTED_STATE
        : MedusaError.Types.INVALID_DATA
      throw new MedusaError(type, error.message)
    }

    throw error
  }
}

async function open(scope: MedusaContainer, id: string): Promise<Session> {
  const carrier = findCarrier(id)

  if (!carrier) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `"${id}" kargo paketi kurulu değil.`)
  }

  const { definition } = carrier
  const license = await licenseStatus(carrier.repo)

  if (!license.valid) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `${definition.label}: ${license.reason}`)
  }

  const settings = await scope
    .resolve<KibisettingsModuleService>(KIBISETTINGS_MODULE)
    .getSecretSettings("carriers")
  const config = carrierConfig(definition, settings)

  if (!config.enabled) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `${definition.label} ayarlarda kapalı.`)
  }

  const client = await guard(() =>
    definition.createClient({ testMode: config.testMode, credentials: config.credentials })
  )

  return { carrier, client, trackingUrl: config.trackingUrl }
}

function withTrackingUrl<T extends { trackingNumber: string | null; trackingUrl: string | null }>(
  result: T,
  template: string
): T {
  if (!result.trackingUrl && result.trackingNumber && template.includes("{code}")) {
    return { ...result, trackingUrl: template.replace("{code}", encodeURIComponent(result.trackingNumber)) }
  }

  return result
}

export async function createShipment(
  scope: MedusaContainer,
  id: string,
  request: ShipmentRequest
): Promise<ShipmentResult> {
  const { carrier, client, trackingUrl } = await open(scope, id)
  const { adapter } = carrier.definition

  return guard(async () => {
    const response = await client.createShipment(adapter.toShipment(request))
    return withTrackingUrl(adapter.fromShipment(request, response), trackingUrl)
  })
}

export async function cancelShipment(scope: MedusaContainer, id: string, reference: string): Promise<void> {
  const { carrier, client } = await open(scope, id)
  const { adapter } = carrier.definition

  await guard(async () => {
    adapter.fromCancel(reference, await client.cancelShipment(adapter.toCancel(reference)))
  })
}

export async function trackShipment(
  scope: MedusaContainer,
  id: string,
  reference: string
): Promise<TrackingResult> {
  const { carrier, client, trackingUrl } = await open(scope, id)
  const { adapter } = carrier.definition

  return guard(async () => {
    const response = await client.queryShipment(adapter.toQuery(reference))
    return withTrackingUrl(adapter.fromQuery(reference, response), trackingUrl)
  })
}
