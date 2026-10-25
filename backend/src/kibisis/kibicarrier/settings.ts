import { CarrierDefinition } from "./contract"
import { installedCarriers } from "./registry"
import { CARRIER_BASE_DEFAULTS, carrierField, CarrierSettings } from "../kibisettings/types"

export type ResolvedCarrierConfig = {
  enabled: boolean
  testMode: boolean
  trackingUrl: string
  credentials: Record<string, string>
}

export function carrierDefaults(definitions = installedDefinitions()): CarrierSettings {
  const values: CarrierSettings = {}

  for (const definition of definitions) {
    for (const [field, value] of Object.entries(CARRIER_BASE_DEFAULTS)) {
      values[carrierField(definition.id, field)] = value
    }

    for (const field of definition.credentials) {
      values[carrierField(definition.id, field.key)] = ""
    }
  }

  return values
}

export function carrierSecretFields(definitions = installedDefinitions()): string[] {
  return definitions.flatMap((definition) =>
    definition.credentials
      .filter((field) => field.secret)
      .map((field) => carrierField(definition.id, field.key))
  )
}

export function carrierConfig(
  definition: CarrierDefinition,
  settings: CarrierSettings
): ResolvedCarrierConfig {
  const read = (field: string) => settings[carrierField(definition.id, field)]
  const credentials: Record<string, string> = {}

  for (const field of definition.credentials) {
    const value = read(field.key)
    credentials[field.key] = typeof value === "string" ? value : ""
  }

  const trackingUrl = read("tracking_url")

  return {
    enabled: read("enabled") === true,
    testMode: read("test_mode") !== false,
    trackingUrl: typeof trackingUrl === "string" && trackingUrl ? trackingUrl : definition.trackingUrl,
    credentials,
  }
}

function installedDefinitions(): CarrierDefinition[] {
  return installedCarriers().carriers.map((carrier) => carrier.definition)
}
