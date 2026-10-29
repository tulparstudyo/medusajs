import { createHash, randomBytes } from "crypto"
import fs from "fs"
import path from "path"

import { MedusaError } from "@medusajs/framework/utils"

import { carrierSources, compileSources, readZip } from "../kibicarrier/installer"
import { forgetLicense } from "../kibicarrier/license"
import { callLicenseServer, licenseServerMessage } from "../kibicarrier/license-server"
import { PAYMENT_MARKETPLACE } from "./marketplace"
import { paymentsDir, stampFile } from "./paths"
import { BUILD_PATTERN, ID_PATTERN, loadProvider } from "./registry"
import { PaymentInstallDTO } from "./types"

const DOWNLOAD_TIMEOUT_MS = 120_000
const KEEP_BUILDS = 2

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function writeAtomic(file: string, content: string): void {
  const temporary = `${file}.${randomBytes(4).toString("hex")}.tmp`
  fs.writeFileSync(temporary, content)
  fs.renameSync(temporary, file)
}

function pruneBuilds(providerDir: string, active: string): void {
  const builds = fs
    .readdirSync(providerDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && BUILD_PATTERN.test(entry.name))
    .map((entry) => ({ name: entry.name, at: fs.statSync(path.join(providerDir, entry.name)).mtimeMs }))
    .sort((a, b) => b.at - a.at)

  for (const build of builds.slice(KEEP_BUILDS)) {
    if (build.name !== active) {
      fs.rmSync(path.join(providerDir, build.name), { recursive: true, force: true })
    }
  }
}

/**
 * Downloads a payment provider from the license server, compiles it into a
 * new build folder and switches current.json to it.
 */
export async function installPaymentProvider(repo: string): Promise<PaymentInstallDTO> {
  if (!PAYMENT_MARKETPLACE.some((item) => item.repo === repo && item.status === "available")) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `${repo} kurulabilir paketler arasında değil.`)
  }

  const response = await callLicenseServer("install.php", repo, "install", DOWNLOAD_TIMEOUT_MS)

  if (!response.ok) {
    const type =
      response.status === 402 || response.status === 403
        ? MedusaError.Types.NOT_ALLOWED
        : MedusaError.Types.UNEXPECTED_STATE
    throw new MedusaError(type, await licenseServerMessage(response))
  }

  const archive = Buffer.from(await response.arrayBuffer())
  const expected = response.headers.get("x-kibisis-sha256")

  if (!expected || createHash("sha256").update(archive).digest("hex") !== expected.toLowerCase()) {
    invalid("İndirilen paketin özeti lisans sunucusunun bildirdiğiyle uyuşmuyor.")
  }

  let files: Map<string, Buffer>
  try {
    files = await readZip(archive)
  } catch (error) {
    return invalid(`Paket arşivi okunamadı: ${error instanceof Error ? error.message : String(error)}`)
  }

  let manifest: { version?: string; kibisis?: { type?: string; id?: string; licensed?: boolean } }
  try {
    manifest = JSON.parse(files.get("package.json")?.toString("utf8") ?? "")
  } catch {
    return invalid("Paketin package.json dosyası okunamadı.")
  }

  const id = manifest.kibisis?.id ?? ""
  if (manifest.kibisis?.type !== "payment" || !ID_PATTERN.test(id)) {
    invalid(`${repo} bir Kibisis ödeme paketi değil.`)
  }

  const sources = carrierSources(files)
  if (!sources.has("index.ts")) {
    invalid(`${repo} paketinde src/index.ts yok.`)
  }

  const compiled = compileSources(sources)
  const ref = response.headers.get("x-kibisis-ref") ?? "main"
  const commit = response.headers.get("x-kibisis-commit") ?? ""
  const version = manifest.version ?? "0.0.0"
  const build = `${(commit || "local").slice(0, 7)}-${Date.now().toString(36)}`
  const providerDir = path.join(paymentsDir(), id)
  const buildDir = path.join(providerDir, build)
  const temporary = path.join(providerDir, `.${build}.tmp`)

  fs.rmSync(temporary, { recursive: true, force: true })

  for (const [name, content] of compiled) {
    const target = path.resolve(temporary, name)
    if (!target.startsWith(temporary + path.sep)) {
      invalid(`Paket dosyası klasör dışına yazılamaz: ${name}`)
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }

  fs.writeFileSync(
    path.join(temporary, "meta.json"),
    JSON.stringify({ repo, ref, commit, version, installedAt: new Date().toISOString() }, null, 2)
  )
  fs.renameSync(temporary, buildDir)

  try {
    loadProvider(buildDir, id)
  } catch (error) {
    fs.rmSync(buildDir, { recursive: true, force: true })
    throw error
  }

  writeAtomic(path.join(providerDir, "current.json"), JSON.stringify({ build }))
  writeAtomic(stampFile(), `${Date.now()} ${randomBytes(4).toString("hex")}`)
  pruneBuilds(providerDir, build)
  forgetLicense(repo)

  return { id, repo, ref, commit, version, files: compiled.size }
}

