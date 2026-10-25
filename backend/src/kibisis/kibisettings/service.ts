import { MedusaService } from "@medusajs/framework/utils"

import SettingsRecord from "./models/settings-record"
import { carrierDefaults, carrierSecretFields } from "../kibicarrier/settings"
import {
  SECRET_FIELDS,
  SETTINGS_DEFAULTS,
  SettingsDTO,
  SettingsInput,
  SettingsKey,
  SettingsValues,
} from "./types"

type SettingsRow = {
  id: string
  settings_key: string
  values?: unknown
  updated_at?: Date | string | null
}

class KibisettingsModuleService extends MedusaService({
  SettingsRecord,
}) {
  async getSettings<K extends SettingsKey>(key: K): Promise<SettingsDTO<K>> {
    return present(key, await this.findRow(key))
  }

  /** Full values including secrets, for server-side consumers only. */
  async getSecretSettings<K extends SettingsKey>(key: K): Promise<SettingsValues[K]> {
    const row = await this.findRow(key)
    return readValues(key, row?.values)
  }

  async updateSettings<K extends SettingsKey>(
    key: K,
    input: SettingsInput
  ): Promise<SettingsDTO<K>> {
    const row = await this.findRow(key)
    const secrets = secretFieldsOf(key)
    // Keeps the values of carrier packages that are not installed right now.
    const next: Record<string, unknown> = {
      ...(key === "carriers" ? plainObject(row?.values) : {}),
      ...readValues(key, row?.values),
    }
    const known = defaultsOf(key)

    for (const [field, value] of Object.entries(input)) {
      if (!(field in known) || value === undefined) {
        continue
      }

      if (secrets.includes(field)) {
        if (value === null) {
          next[field] = ""
        } else if (typeof value === "string" && value !== "") {
          next[field] = value
        }
        continue
      }

      next[field] = value
    }

    if (row) {
      const updated = await this.updateSettingsRecords({ id: row.id, values: next })
      return present(key, updated)
    }

    try {
      const created = await this.createSettingsRecords({ settings_key: key, values: next })
      return present(key, created)
    } catch (error) {
      const again = await this.findRow(key)
      if (!again) {
        throw error
      }

      const updated = await this.updateSettingsRecords({ id: again.id, values: next })
      return present(key, updated)
    }
  }

  private async findRow(key: SettingsKey): Promise<SettingsRow | null> {
    const [row] = await this.listSettingsRecords({ settings_key: key }, { take: 1 })
    return row ?? null
  }
}

function defaultsOf(key: SettingsKey): Record<string, unknown> {
  return key === "carriers" ? carrierDefaults() : (SETTINGS_DEFAULTS[key] as Record<string, unknown>)
}

function secretFieldsOf(key: SettingsKey): readonly string[] {
  return key === "carriers" ? carrierSecretFields() : (SECRET_FIELDS[key] as readonly string[])
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function readValues<K extends SettingsKey>(key: K, stored: unknown): SettingsValues[K] {
  const defaults = defaultsOf(key)
  const values: Record<string, unknown> = { ...defaults }

  for (const [field, value] of Object.entries(plainObject(stored))) {
    if (field in defaults && typeof value === typeof defaults[field]) {
      values[field] = value
    }
  }

  return values as SettingsValues[K]
}

function present<K extends SettingsKey>(key: K, row: SettingsRow | null): SettingsDTO<K> {
  const values: Record<string, unknown> = { ...readValues(key, row?.values) }
  const secrets: Record<string, boolean> = {}

  for (const field of secretFieldsOf(key)) {
    secrets[field] = typeof values[field] === "string" && values[field] !== ""
    values[field] = ""
  }

  const updatedAt = row?.updated_at
  return {
    key,
    values: values as SettingsValues[K],
    secrets,
    updated_at: updatedAt ? new Date(updatedAt).toISOString() : null,
  }
}

export default KibisettingsModuleService
