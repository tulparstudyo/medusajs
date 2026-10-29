import { PaymentConfig, PaymentDefinition } from "./contract"
import { installedProviders } from "./registry"

export function paymentField(id: string, field: string): string {
  return `${id}_${field}`
}

export const BASE_PAYMENT_DEFAULTS = {
  bank_transfer_enabled: false,
  bank_transfer_info: "",
  bank_transfer_discount: 0,
  cod_enabled: false,
  cod_fee: 0,
}

export type DynamicPaymentSettings = Record<string, string | boolean | number>

export function paymentDefaults(definitions = installedPaymentDefinitions()): DynamicPaymentSettings {
  const values: DynamicPaymentSettings = { ...BASE_PAYMENT_DEFAULTS }

  for (const definition of definitions) {
    values[paymentField(definition.id, "enabled")] = false
    values[paymentField(definition.id, "test_mode")] = true
    values[paymentField(definition.id, "installments_enabled")] = false
    values[paymentField(definition.id, "max_installments")] = 6

    for (const field of definition.credentials) {
      values[paymentField(definition.id, field.key)] = ""
    }
  }

  return values
}

export function paymentSecretFields(definitions = installedPaymentDefinitions()): string[] {
  return definitions.flatMap((definition) =>
    definition.credentials
      .filter((field) => field.secret)
      .map((field) => paymentField(definition.id, field.key))
  )
}

export function paymentProviderConfig(
  definition: PaymentDefinition,
  settings: Record<string, unknown>
): { enabled: boolean; config: PaymentConfig } {
  const read = (field: string) => settings[paymentField(definition.id, field)]
  const credentials: Record<string, string> = {}

  for (const field of definition.credentials) {
    const value = read(field.key)
    credentials[field.key] = typeof value === "string" ? value : ""
  }

  const enabled = read("enabled") === true
  const testMode = read("test_mode") !== false
  const installmentsEnabled = read("installments_enabled") === true
  const maxInstallments = typeof read("max_installments") === "number" ? (read("max_installments") as number) : 6

  return {
    enabled,
    config: {
      testMode,
      installmentsEnabled,
      maxInstallments,
      credentials,
    },
  }
}

function installedPaymentDefinitions(): PaymentDefinition[] {
  return installedProviders().providers.map((p) => p.definition)
}

