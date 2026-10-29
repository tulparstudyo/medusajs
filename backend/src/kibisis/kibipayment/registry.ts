import fs from "fs"
import { createRequire } from "module"
import path from "path"

import { MedusaError } from "@medusajs/framework/utils"

import { CredentialField, PAYMENT_API_VERSION, PaymentDefinition } from "./contract"
import { licenseServer } from "../kibicarrier/license-server"
import { licenseStatus } from "../kibicarrier/license"
import { PAYMENT_MARKETPLACE } from "./marketplace"
import { paymentsDir, stampFile } from "./paths"
import { PaymentCatalogDTO, InstalledPaymentProviderDTO, PaymentLicenseDTO } from "./types"

export type PaymentMeta = {
  repo: string
  ref: string
  commit: string
  version: string
  installedAt: string
}

export type InstalledPaymentProvider = PaymentMeta & {
  id: string
  build: string
  definition: PaymentDefinition
}

export type Discovery = {
  providers: InstalledPaymentProvider[]
  errors: { id: string; message: string }[]
}

export const ID_PATTERN = /^[a-z0-9]{2,30}$/
export const BUILD_PATTERN = /^[a-z0-9]+-[a-z0-9]+$/
const FIELD_PATTERN = /^[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*$/
const RESERVED_FIELDS = ["enabled", "test_mode", "installments_enabled", "max_installments"]

const load = createRequire(__filename)

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

function assertDefinition(value: unknown, id: string): PaymentDefinition {
  const definition = value as Partial<PaymentDefinition> | null
  const fail = (message: string) => invalid(`${id}: ${message}`)

  if (!definition || typeof definition !== "object") {
    return fail("index varsayılan dışa aktarımı bir ödeme sağlayıcı tanımı değil.")
  }

  if (definition.apiVersion !== PAYMENT_API_VERSION) {
    fail(`apiVersion ${String(definition.apiVersion)} desteklenmiyor (beklenen ${PAYMENT_API_VERSION}).`)
  }

  if (definition.id !== id) {
    fail(`tanım kimliği "${String(definition.id)}" klasör adıyla aynı olmalı.`)
  }

  if (typeof definition.label !== "string" || !definition.label.trim()) {
    fail("label eksik.")
  }

  if (typeof definition.product !== "string" || !definition.product) {
    fail("product eksik.")
  }

  if (typeof definition.createClient !== "function" || !definition.adapter) {
    fail("createClient veya adapter eksik.")
  }

  if (!Array.isArray(definition.credentials)) {
    fail("credentials bir dizi olmalı.")
  }

  for (const field of definition.credentials as CredentialField[]) {
    if (!field || !FIELD_PATTERN.test(field.key) || RESERVED_FIELDS.includes(field.key)) {
      fail(`geçersiz kimlik bilgisi alanı: ${String(field?.key)}`)
    }
  }

  return definition as PaymentDefinition
}

function assertMeta(value: unknown, id: string): PaymentMeta {
  const meta = value as Partial<PaymentMeta> | null

  if (!meta || typeof meta.repo !== "string" || typeof meta.ref !== "string") {
    return invalid(`${id}: meta.json eksik veya bozuk.`)
  }

  return {
    repo: meta.repo,
    ref: meta.ref,
    commit: String(meta.commit ?? ""),
    version: String(meta.version ?? "0.0.0"),
    installedAt: String(meta.installedAt ?? ""),
  }
}

/** Loads one compiled build: meta.json plus index.js exporting PaymentDefinition. */
export function loadProvider(buildDir: string, id: string): InstalledPaymentProvider {
  const meta = assertMeta(JSON.parse(fs.readFileSync(path.join(buildDir, "meta.json"), "utf8")), id)
  const loaded = load(path.join(buildDir, "index.js")) as { default?: unknown }
  const definition = assertDefinition(loaded.default ?? loaded, id)

  return { id, build: path.basename(buildDir), ...meta, definition }
}

function activeBuild(providerDir: string, id: string): string {
  let build: unknown
  try {
    build = (JSON.parse(fs.readFileSync(path.join(providerDir, "current.json"), "utf8")) as { build?: unknown }).build
  } catch {
    return invalid(`${id}: current.json okunamadı.`)
  }

  if (typeof build !== "string" || !BUILD_PATTERN.test(build)) {
    return invalid(`${id}: current.json geçersiz bir sürüm gösteriyor.`)
  }

  return build
}

/** Loads the active build of every payment provider under <dir>/<id>/. */
export function discoverProviders(dir = paymentsDir()): Discovery {
  const discovery: Discovery = { providers: [], errors: [] }

  if (!fs.existsSync(dir)) {
    return discovery
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) {
      continue
    }

    const id = entry.name
    try {
      const providerDir = path.join(dir, id)
      discovery.providers.push(loadProvider(path.join(providerDir, activeBuild(providerDir, id)), id))
    } catch (error) {
      discovery.errors.push({ id, message: error instanceof Error ? error.message : String(error) })
    }
  }

  return discovery
}

function readStamp(): string {
  try {
    return fs.readFileSync(stampFile(), "utf8")
  } catch {
    return ""
  }
}

let cached: { stamp: string; discovery: Discovery } | null = null

/** Reloads when an install touched the stamp file, in this or any other process. */
export function installedProviders(): Discovery {
  const stamp = readStamp()

  if (!cached || cached.stamp !== stamp) {
    cached = { stamp, discovery: discoverProviders() }
  }

  return cached.discovery
}

export function findProvider(id: string): InstalledPaymentProvider | null {
  return installedProviders().providers.find((provider) => provider.id === id) ?? null
}

export async function resolveProviderLicense(provider: InstalledPaymentProvider): Promise<PaymentLicenseDTO> {
  if (provider.definition.licensed === false) {
    return {
      valid: true,
      licensed: false,
      reason: null,
      customer: "Ücretsiz paket",
      expires_at: null,
      ref: provider.ref,
      checked_at: new Date().toISOString(),
    }
  }

  const status = await licenseStatus(provider.repo)
  return {
    valid: status.valid,
    licensed: true,
    reason: status.reason,
    customer: status.customer,
    expires_at: status.expires_at,
    ref: status.ref,
    checked_at: status.checked_at,
  }
}

export async function presentPaymentProvider(provider: InstalledPaymentProvider): Promise<InstalledPaymentProviderDTO> {
  const { definition } = provider
  const license = await resolveProviderLicense(provider)

  return {
    id: provider.id,
    label: definition.label,
    description: definition.description ?? null,
    repo: provider.repo,
    ref: provider.ref,
    commit: provider.commit,
    version: provider.version,
    installed_at: provider.installedAt,
    product: definition.product,
    licensed: definition.licensed !== false,
    supports_installments: definition.supportsInstallments !== false,
    credentials: definition.credentials.map((field) => ({
      key: field.key,
      label: field.label,
      secret: !!field.secret,
      required: !!field.required,
      placeholder: field.placeholder ?? null,
      hint: field.hint ?? null,
    })),
    license,
  }
}

export async function paymentCatalog(): Promise<PaymentCatalogDTO> {
  const { providers, errors } = installedProviders()
  const installedIds = new Set(providers.map((p) => p.id))
  const server = licenseServer()

  return {
    installed: await Promise.all(providers.map(presentPaymentProvider)),
    available: PAYMENT_MARKETPLACE.filter((item) => !installedIds.has(item.id)),
    errors,
    install_enabled: !!server.url,
    domain: server.domain,
    store_url: process.env.KIBISIS_SHOP_URL || null,
  }
}
