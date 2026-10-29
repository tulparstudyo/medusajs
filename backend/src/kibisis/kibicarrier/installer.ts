import { createHash, randomBytes } from "crypto"
import fs from "fs"
import { createRequire } from "module"
import path from "path"

import { MedusaError } from "@medusajs/framework/utils"
import type * as TypeScript from "typescript"
import yauzl from "yauzl"

import { forgetLicense } from "./license"
import { callLicenseServer, licenseServerMessage } from "./license-server"
import { CARRIER_MARKETPLACE } from "./marketplace"
import { carriersDir, stampFile } from "./paths"
import { BUILD_PATTERN, ID_PATTERN, loadCarrier } from "./registry"
import { CarrierInstallDTO } from "./types"

const DOWNLOAD_TIMEOUT_MS = 120_000
const MAX_FILES = 200
const MAX_BYTES = 10 * 1024 * 1024
const KEEP_BUILDS = 2
const SOURCE_PATTERN = /^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.ts$/

const load = createRequire(__filename)

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

/** Reads every file of a zip into memory, refusing oversized or unsafe archives. */
export async function readZip(buffer: Buffer): Promise<Map<string, Buffer>> {
  const zip = await yauzl.fromBufferPromise(buffer, { lazyEntries: true, strictFileNames: true })
  const files = new Map<string, Buffer>()
  let total = 0

  return new Promise((resolve, reject) => {
    zip.on("error", reject)
    zip.on("end", () => resolve(files))
    zip.on("entry", (entry: yauzl.Entry) => {
      if (entry.fileName.endsWith("/")) {
        zip.readEntry()
        return
      }

      total += entry.uncompressedSize
      if (files.size >= MAX_FILES || total > MAX_BYTES || entry.isEncrypted()) {
        zip.close()
        reject(new Error("Paket arşivi çok büyük veya şifreli."))
        return
      }

      zip
        .openReadStreamPromise(entry)
        .then((stream) => {
          const chunks: Buffer[] = []
          stream.on("data", (chunk: Buffer) => chunks.push(chunk))
          stream.on("error", reject)
          stream.on("end", () => {
            files.set(entry.fileName, Buffer.concat(chunks))
            zip.readEntry()
          })
        })
        .catch(reject)
    })
    zip.readEntry()
  })
}

/** Picks `src/**.ts` files and maps them to paths inside the carrier folder. */
export function carrierSources(files: Map<string, Buffer>): Map<string, Buffer> {
  const sources = new Map<string, Buffer>()

  for (const [name, content] of files) {
    if (SOURCE_PATTERN.test(name) && !name.split("/").includes("..")) {
      sources.set(name.slice("src/".length), content)
    }
  }

  return sources
}

function typescript(): typeof TypeScript {
  try {
    return load("typescript") as typeof TypeScript
  } catch {
    return invalid("Kurulum için backend'de typescript paketi gerekli.")
  }
}

/**
 * Transpiles carrier sources to CommonJS without type checking, so the
 * running server can require them without a build step.
 */
export function compileSources(sources: Map<string, Buffer>): Map<string, string> {
  const ts = typescript()
  const output = new Map<string, string>()

  for (const [name, content] of sources) {
    const result = ts.transpileModule(content.toString("utf8"), {
      fileName: name,
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2021,
        esModuleInterop: true,
      },
    })
    const [error] = result.diagnostics ?? []

    if (error) {
      invalid(`${name} derlenemedi: ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`)
    }

    output.set(name.replace(/\.ts$/, ".js"), result.outputText)
  }

  return output
}

function writeAtomic(file: string, content: string): void {
  const temporary = `${file}.${randomBytes(4).toString("hex")}.tmp`
  fs.writeFileSync(temporary, content)
  fs.renameSync(temporary, file)
}

function pruneBuilds(carrierDir: string, active: string): void {
  const builds = fs
    .readdirSync(carrierDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && BUILD_PATTERN.test(entry.name))
    .map((entry) => ({ name: entry.name, at: fs.statSync(path.join(carrierDir, entry.name)).mtimeMs }))
    .sort((a, b) => b.at - a.at)

  for (const build of builds.slice(KEEP_BUILDS)) {
    if (build.name !== active) {
      fs.rmSync(path.join(carrierDir, build.name), { recursive: true, force: true })
    }
  }
}

/**
 * Downloads a licensed carrier from the license server, compiles it into a
 * new build folder and switches current.json to it. Running processes pick
 * the build up on their next request through the stamp file.
 */
export async function installCarrier(repo: string): Promise<CarrierInstallDTO> {
  if (!CARRIER_MARKETPLACE.some((item) => item.repo === repo && item.status === "available")) {
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
  const actual = createHash("sha256").update(archive).digest("hex")

  if (archive.length < 4 || archive[0] !== 0x50 || archive[1] !== 0x4b) {
    const preview = archive.slice(0, 300).toString("utf8")
    invalid(`Lisans sunucusundan geçerli bir paket arşivi alınamadı: ${preview}`)
  }

  if (expected && actual !== expected.toLowerCase()) {
    invalid(
      `İndirilen paketin özeti lisans sunucusunun bildirdiğiyle uyuşmuyor (beklenen: ${expected}, hesaplanan: ${actual}).`
    )
  }

  let files: Map<string, Buffer>
  try {
    files = await readZip(archive)
  } catch (error) {
    return invalid(`Paket arşivi okunamadı: ${error instanceof Error ? error.message : String(error)}`)
  }

  let manifest: { version?: string; kibisis?: { type?: string; id?: string } }
  try {
    manifest = JSON.parse(files.get("package.json")?.toString("utf8") ?? "")
  } catch {
    return invalid("Paketin package.json dosyası okunamadı.")
  }

  const id = manifest.kibisis?.id ?? ""
  if (manifest.kibisis?.type !== "carrier" || !ID_PATTERN.test(id)) {
    invalid(`${repo} bir Kibisis kargo paketi değil.`)
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
  const carrierDir = path.join(carriersDir(), id)
  const buildDir = path.join(carrierDir, build)
  const temporary = path.join(carrierDir, `.${build}.tmp`)

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
    loadCarrier(buildDir, id)
  } catch (error) {
    fs.rmSync(buildDir, { recursive: true, force: true })
    throw error
  }

  writeAtomic(path.join(carrierDir, "current.json"), JSON.stringify({ build }))
  writeAtomic(stampFile(), `${Date.now()} ${randomBytes(4).toString("hex")}`)
  pruneBuilds(carrierDir, build)
  forgetLicense(repo)

  return { id, repo, ref, commit, version, files: compiled.size }
}
