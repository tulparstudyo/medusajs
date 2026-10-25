import fs from "fs"
import os from "os"
import path from "path"

import { openChallenge, takeChallenge } from "../challenge"
import { carrierSources, compileSources } from "../installer"
import { forgetLicense, licenseStatus } from "../license"
import { discoverCarriers } from "../registry"
import { carrierConfig, carrierDefaults, carrierSecretFields } from "../settings"
import { CreateShipmentSchema, toShipmentRequest } from "../validators"

function writeCarrier(root: string, id: string, definitionId = id, apiVersion = 1) {
  const build = "abc1234-old"
  const dir = path.join(root, id, build)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(root, id, "current.json"), JSON.stringify({ build }))
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify({ repo: `kibisis-${id}`, ref: "main", commit: "abc1234", version: "1.2.3", installedAt: "2026-10-25T00:00:00.000Z" })
  )
  fs.writeFileSync(
    path.join(dir, "index.js"),
    `exports.default = {
      apiVersion: ${apiVersion},
      id: "${definitionId}",
      product: "kibisis-${id}",
      label: "Kargo ${id}",
      credentials: [
        { key: "username", label: "Kullanıcı" },
        { key: "password", label: "Şifre", secret: true },
      ],
      trackingUrl: "https://kargo.example/{code}",
      createClient() { return {} },
      adapter: {},
    }`
  )
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

describe("kibicarrier", () => {
  let root: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "kibicarrier-"))
    writeCarrier(root, "fake")
    writeCarrier(root, "future", "future", 2)
    writeCarrier(root, "mixed", "other")
    fs.mkdirSync(path.join(root, "nocurrent", "abc1234-old"), { recursive: true })
    fs.mkdirSync(path.join(root, ".fake-tmp"))
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("loads installed carriers and reports broken ones", () => {
    const { carriers, errors } = discoverCarriers(root)

    expect(
      carriers.map((carrier) => [carrier.id, carrier.build, carrier.repo, carrier.version, carrier.commit])
    ).toEqual([["fake", "abc1234-old", "kibisis-fake", "1.2.3", "abc1234"]])
    expect(errors.map((error) => error.id).sort()).toEqual(["future", "mixed", "nocurrent"])
    expect(discoverCarriers(path.join(root, "missing"))).toEqual({ carriers: [], errors: [] })
  })

  it("derives settings fields from carrier credentials", () => {
    const definitions = discoverCarriers(root).carriers.map((carrier) => carrier.definition)

    expect(carrierDefaults(definitions)).toEqual({
      fake_enabled: false,
      fake_test_mode: true,
      fake_tracking_url: "",
      fake_username: "",
      fake_password: "",
    })
    expect(carrierSecretFields(definitions)).toEqual(["fake_password"])
    expect(
      carrierConfig(definitions[0], { fake_enabled: true, fake_username: "u", fake_password: "p" })
    ).toEqual({
      enabled: true,
      testMode: true,
      trackingUrl: "https://kargo.example/{code}",
      credentials: { username: "u", password: "p" },
    })
  })

  it("takes only src TypeScript files from the archive", () => {
    const files = new Map<string, Buffer>([
      ["package.json", Buffer.from("{}")],
      ["src/index.ts", Buffer.from("a")],
      ["src/lib/soap.ts", Buffer.from("b")],
      ["src/../evil.ts", Buffer.from("c")],
      ["src/readme.md", Buffer.from("d")],
      ["test/client.test.js", Buffer.from("e")],
    ])

    expect([...carrierSources(files).keys()]).toEqual(["index.ts", "lib/soap.ts"])
  })

  it("compiles carrier sources into loadable CommonJS", () => {
    const compiled = compileSources(
      new Map([
        [
          "client.ts",
          Buffer.from(`
            import type { Config } from "./types"
            export class Client {
              constructor(private readonly config: Config) {}
              greet(): string { return "merhaba " + this.config.name }
            }
          `),
        ],
        ["types.ts", Buffer.from("export type Config = { name: string }")],
        [
          "index.ts",
          Buffer.from(`
            import { Client } from "./client"
            export default { create: (name: string) => new Client({ name }) }
          `),
        ],
      ])
    )

    expect([...compiled.keys()].sort()).toEqual(["client.js", "index.js", "types.js"])

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kibicarrier-build-"))
    for (const [name, source] of compiled) {
      fs.writeFileSync(path.join(dir, name), source)
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require(path.join(dir, "index.js")).default
    expect(loaded.create("Ayşe").greet()).toBe("merhaba Ayşe")
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("refuses sources with syntax errors", () => {
    expect(() => compileSources(new Map([["index.ts", Buffer.from("export default {")]]))).toThrow(
      "index.ts derlenemedi"
    )
  })

  it("answers a challenge once", () => {
    const id = openChallenge({ domain: "localhost:9000", repo: "kibisis-fake", purpose: "install" })

    expect(id).toMatch(/^[a-f0-9]{32}$/)
    expect(takeChallenge(id)).toEqual({ domain: "localhost:9000", repo: "kibisis-fake", purpose: "install" })
    expect(takeChallenge(id)).toBeNull()
  })

  describe("license", () => {
    const env = { ...process.env }
    let fetchMock: jest.SpyInstance

    beforeEach(() => {
      process.env.KIBISIS_LICENSE_SERVER_URL = "http://license.test/install/"
      process.env.KIBISIS_SHOP_URL = "https://magaza.com"
      forgetLicense("kibisis-fake")
      fetchMock = jest.spyOn(global, "fetch")
    })

    afterEach(() => {
      fetchMock.mockRestore()
      process.env = { ...env }
    })

    it("sends domain, repo, challenge and Origin, then caches a valid answer", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { valid: true, customer: "Mağaza", expires_at: "2027-10-25", ref: "main" })
      )

      const first = await licenseStatus("kibisis-fake")
      const second = await licenseStatus("kibisis-fake")

      expect(first).toMatchObject({ valid: true, customer: "Mağaza", expires_at: "2027-10-25", ref: "main" })
      expect(second).toBe(first)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      const [url, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body)
      expect(url).toBe("http://license.test/install/verify.php")
      expect(init.headers.origin).toBe("https://magaza.com")
      expect(body).toMatchObject({ domain: "magaza.com", repo: "kibisis-fake" })
      expect(body.challenge_id).toMatch(/^[a-f0-9]{32}$/)
    })

    it("reports the license server's refusal", async () => {
      fetchMock.mockResolvedValue(jsonResponse(402, { message: "magaza.com için kibisis-fake lisansı bulunamadı." }))

      expect(await licenseStatus("kibisis-fake")).toMatchObject({
        valid: false,
        reason: "magaza.com için kibisis-fake lisansı bulunamadı.",
      })
    })

    it("keeps a recent valid answer while the server is unreachable", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { valid: true, ref: "main" }))
      await licenseStatus("kibisis-fake")

      fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"))
      const offline = await licenseStatus("kibisis-fake", { force: true })

      expect(offline.valid).toBe(true)
      expect(offline.reason).toContain("ECONNREFUSED")
    })

    it("is invalid when no license server is configured", async () => {
      delete process.env.KIBISIS_LICENSE_SERVER_URL

      expect(await licenseStatus("kibisis-fake")).toMatchObject({
        valid: false,
        reason: "KIBISIS_LICENSE_SERVER_URL tanımlı değil.",
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  it("maps the shipment API body to the carrier contract", () => {
    const input = CreateShipmentSchema.parse({
      reference: "KBS-1",
      receiver: {
        name: "Ayşe Yılmaz",
        phone: "05321234567",
        address: "Atatürk Cad. No 12",
        city: "İstanbul",
        district: "Kadıköy",
      },
      cash_on_delivery: { amount: "10.50", currency: "try" },
    })

    expect(toShipmentRequest(input)).toMatchObject({
      reference: "KBS-1",
      parcels: 1,
      receiver: { email: null, postalCode: null },
      cashOnDelivery: { amount: "10.50", currency: "TRY" },
    })
  })
})
