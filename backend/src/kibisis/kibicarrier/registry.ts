import fs from "fs"
import { createRequire } from "module"
import path from "path"

import { MedusaError } from "@medusajs/framework/utils"

import { CARRIER_API_VERSION, CarrierDefinition, CredentialField } from "./contract"
import { licenseServer } from "./license-server"
import { licenseStatus } from "./license"
import { CARRIER_MARKETPLACE } from "./marketplace"
import { carriersDir, stampFile } from "./paths"
import { CarrierCatalogDTO, InstalledCarrierDTO } from "./types"

export type CarrierMeta = {
  repo: string
  ref: string
  commit: string
  version: string
  installedAt: string
}

export type InstalledCarrier = CarrierMeta & {
  id: string
  build: string
  definition: CarrierDefinition
}

export type Discovery = {
  carriers: InstalledCarrier[]
  errors: { id: string; message: string }[]
}

export const ID_PATTERN = /^[a-z0-9]{2,30}$/
export const BUILD_PATTERN = /^[a-z0-9]+-[a-z0-9]+$/
const FIELD_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/
const RESERVED_FIELDS = ["enabled", "test_mode", "tracking_url"]

const load = createRequire(__filename)

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

function assertDefinition(value: unknown, id: string): CarrierDefinition {
  const definition = value as Partial<CarrierDefinition> | null
  const fail = (message: string) => invalid(`${id}: ${message}`)

  if (!definition || typeof definition !== "object") {
    return fail("index varsay?lan d??a aktar?m? bir kargo tan?m? de?il.")
  }

  if (definition.apiVersion !== CARRIER_API_VERSION) {
    fail(`apiVersion ${String(definition.apiVersion)} desteklenmiyor (beklenen ${CARRIER_API_VERSION}).`)
  }

  if (definition.id !== id) {
    fail(`tan?m kimli?i "${String(definition.id)}" klasör ad?yla ayn? olmal?.`)
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
    fail("credentials bir dizi olmal?.")
  }

  for (const field of definition.credentials as CredentialField[]) {
    if (!field || !FIELD_PATTERN.test(field.key) || RESERVED_FIELDS.includes(field.key)) {
      fail(`geçersiz kimlik bilgisi alan?: ${String(field?.key)}`)
    }
  }

  return definition as CarrierDefinition
}

function assertMeta(value: unknown, id: string): CarrierMeta {
  const meta = value as Partial<CarrierMeta> | null

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

/** Loads one compiled build: meta.json plus index.js exporting the CarrierDefinition. */
export function loadCarrier(buildDir: string, id: string): InstalledCarrier {
  const meta = assertMeta(JSON.parse(fs.readFileSync(path.join(buildDir, "meta.json"), "utf8")), id)
  const loaded = load(path.join(buildDir, "index.js")) as { default?: unknown }
  const definition = assertDefinition(loaded.default ?? loaded, id)

  return { id, build: path.basename(buildDir), ...meta, definition }
}

function activeBuild(carrierDir: string, id: string): string {
  let build: unknown
  try {
    build = (JSON.parse(fs.readFileSync(path.join(carrierDir, "current.json"), "utf8")) as { build?: unknown }).build
  } catch {
    return invalid(`${id}: current.json okunamad?.`)
  }

  if (typeof build !== "string" || !BUILD_PATTERN.test(build)) {
    return invalid(`${id}: current.json geçersiz bir sürüm gösteriyor.`)
  }

  return build
}

/** Loads the active build of every carrier under <dir>/<id>/. */
export function discoverCarriers(dir = carriersDir()): Discovery {
  const discovery: Discovery = { carriers: [], errors: [] }

  if (!fs.existsSync(dir)) {
    return discovery
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) {
      continue
    }

    const id = entry.name
    try {
      const carrierDir = path.join(dir, id)
      discovery.carriers.push(loadCarrier(path.join(carrierDir, activeBuild(carrierDir, id)), id))
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
export function installedCarriers(): Discovery {
  const stamp = readStamp()

  if (!cached || cached.stamp !== stamp) {
    cached = { stamp, discovery: discoverCarriers() }
  }

  return cached.discovery
}

export function findCarrier(id: string): InstalledCarrier | null {
  return installedCarriers().carriers.find((carrier) => carrier.id === id) ?? null
}

export async function presentCarrier(carrier: InstalledCarrier): Promise<InstalledCarrierDTO> {
  const { definition } = carrier

  return {
    id: carrier.id,
    label: definition.label,
    description: definition.description ?? null,
    repo: carrier.repo,
    ref: carrier.ref,
    commit: carrier.commit,
    version: carrier.version,
    installed_at: carrier.installedAt,
    product: definition.product,
    tracking_url: definition.trackingUrl,
    credentials: definition.credentials.map((field) => ({
      key: field.key,
      label: field.label,
      secret: !!field.secret,
      required: !!field.required,
      placeholder: field.placeholder ?? null,
      hint: field.hint ?? null,
    })),
    license: await licenseStatus(carrier.repo),
  }
}

export async function carrierCatalog(): Promise<CarrierCatalogDTO> {
  const { carriers, errors } = installedCarriers()
  const installedIds = new Set(carriers.map((carrier) => carrier.id))
  const server = licenseServer()

  return {
    installed: await Promise.all(carriers.map(presentCarrier)),
    available: CARRIER_MARKETPLACE.filter((item) => !installedIds.has(item.id)),
    errors,
    install_enabled: !!server.url,
    domain: server.domain,
    store_url: process.env.KIBISIS_STORE_URL || null,
  }
}
