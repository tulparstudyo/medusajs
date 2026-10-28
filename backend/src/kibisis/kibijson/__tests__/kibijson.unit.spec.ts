import fs from "fs/promises"
import os from "os"
import path from "path"

import { MedusaError } from "@medusajs/framework/utils"

import { HttpStatusException, ImportException } from "../../kibiimport/errors"
import { mergeEntryPrices, PriceRow } from "../../kibiimport/prices"
import { adaptProduct } from "../adapter"
import { isRetryable, RetryableException } from "../errors"
import { stableJson } from "../hash"
import {
  buildImageSet,
  checkLocalImage,
  isSafeRelativePath,
  readLocalImage,
  sniffImage,
} from "../local-images"
import { EnvelopeSchema, issueLines, ProductDocumentSchema } from "../schema"
import { CategoryIndex, resolveCategories } from "../taxonomy"
import { matchLocale } from "../translations"
import sample from "./fixtures/sample-document.json"

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

function product(overrides: Record<string, unknown> = {}) {
  return { ...structuredClone(sample.products[0]), locale: "tr", currency: "try", ...overrides }
}

describe("kibijson", () => {
  describe("schema and adapter", () => {
    it("accepts the sample document", () => {
      expect(EnvelopeSchema.safeParse(sample).success).toBe(true)
      expect(ProductDocumentSchema.safeParse(product()).success).toBe(true)
    })

    it("maps a product document to the importer product", () => {
      const parsed = ProductDocumentSchema.parse(product())
      const adapted = adaptProduct(parsed, "eski-site.com")

      expect(adapted.product.source).toBe("json:eski-site.com")
      expect(adapted.product.externalId).toBe("18452")
      expect(adapted.product.color).toBe("Siyah")
      expect(adapted.product.currency).toBe("TRY")
      expect(adapted.product.taxRate).toBe("20")
      expect(adapted.images).toEqual([
        "elb-2026-001/siyah-01.jpg",
        "elb-2026-001/siyah-02.jpg",
        "https://cdn.eski-site.com/18452-3.jpg",
      ])
      expect(adapted.group).toEqual({ mainCode: "ELB-2026-001", colorHex: "#000000", position: 0 })

      const [small, medium] = adapted.product.variants
      expect(small?.attributes).toEqual([{ name: "Beden", value: "S" }])
      expect(small?.price).toBe("1299.90")
      expect(small?.compareAtPrice).toBe("1599.90")
      expect(small?.extras?.prices).toEqual([
        { currency: "try", amount: "1299.90", compareAt: "1599.90" },
        { currency: "eur", amount: "39.90", compareAt: null },
      ])
      expect(small?.extras?.quantity).toBe(12)
      expect(small?.extras?.imageIndexes).toEqual([0, 2])
      expect(small?.inStock).toBe(true)
      expect(medium?.inStock).toBe(false)
      expect(medium?.extras?.imageIndexes).toBeUndefined()
      expect(adapted.product.extras?.originCountry).toBe("tr")
      expect(adapted.product.extras?.metadata).toEqual({
        legacy_id: 18452,
        seo: sample.products[0].seo,
        source_url: "https://eski-site.com/urun/18452",
        related: { color_siblings: ["18453"] },
      })
    })

    it("keeps the product images when the document has no images field", () => {
      const { images: _images, ...rest } = product()
      const variants = rest.variants.map(({ images: _refs, ...variant }) => variant)
      const adapted = adaptProduct(ProductDocumentSchema.parse({ ...rest, variants }), "x")

      expect(adapted.images).toBeNull()
    })

    it("refuses unsafe paths, double sources and unknown image keys", () => {
      const result = ProductDocumentSchema.safeParse(
        product({
          images: ["../etc/passwd", { path: "a.jpg", url: "https://x.test/a.jpg" }, { key: "a", path: "a.jpg" }, { key: "a", path: "b.jpg" }],
          variants: [{ barcode: "1", options: {}, images: ["missing", 9] }],
        })
      )

      expect(result.success).toBe(false)
      const lines = result.success ? [] : issueLines(result.error)
      expect(lines.some((line) => line.startsWith("images.0:"))).toBe(true)
      expect(lines.some((line) => line.startsWith("images.1:"))).toBe(true)
      expect(lines.some((line) => line.includes("tekrar ediyor"))).toBe(true)
      expect(lines.filter((line) => line.startsWith("variants.0.images:"))).toHaveLength(2)
    })

    it("requires a barcode and a colour", () => {
      const result = ProductDocumentSchema.safeParse(product({ color: "", variants: [{ barcode: "" }] }))
      const lines = result.success ? [] : issueLines(result.error)

      expect(lines.some((line) => line.startsWith("color"))).toBe(true)
      expect(lines.some((line) => line.startsWith("variants.0.barcode"))).toBe(true)
    })
  })

  describe("paths and files", () => {
    let root: string
    const old = new Date(Date.now() - 60_000)

    beforeAll(async () => {
      root = await fs.mkdtemp(path.join(os.tmpdir(), "kibijson-"))
      process.env.KIBIIMPORT_IMAGE_ROOT = root
      await fs.mkdir(path.join(root, "batch", "p1"), { recursive: true })
      await fs.writeFile(path.join(root, "batch", "p1", "a.jpg"), JPEG)
      await fs.writeFile(path.join(root, "batch", "p1", "b.png"), PNG)
      await fs.writeFile(path.join(root, "batch", "p1", "fake.jpg"), "not an image")
      await fs.writeFile(path.join(root, "batch", "p1", "fresh.jpg"), JPEG)

      for (const name of ["a.jpg", "b.png", "fake.jpg"]) {
        await fs.utimes(path.join(root, "batch", "p1", name), old, old)
      }
    })

    afterAll(async () => {
      await fs.rm(root, { recursive: true, force: true })
    })

    it("accepts only relative paths inside the root", () => {
      expect(isSafeRelativePath("batch/p1/a.jpg")).toBe(true)
      expect(isSafeRelativePath("../a.jpg")).toBe(false)
      expect(isSafeRelativePath("batch/../../a.jpg")).toBe(false)
      expect(isSafeRelativePath("/etc/passwd")).toBe(false)
      expect(isSafeRelativePath("C:/Windows/win.ini")).toBe(false)
      expect(isSafeRelativePath("batch\\a.jpg")).toBe(false)
      expect(isSafeRelativePath("batch//a.jpg")).toBe(false)
    })

    it("names images by their bytes", () => {
      expect(sniffImage(JPEG)).toBe("image/jpeg")
      expect(sniffImage(PNG)).toBe("image/png")
      expect(sniffImage(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp")
      expect(sniffImage(Buffer.from("GIF89a"))).toBe("image/gif")
      expect(sniffImage(Buffer.from("\0\0\0\x1cftypavif"))).toBe("image/avif")
      expect(sniffImage(Buffer.from("<svg></svg>"))).toBeNull()
    })

    it("checks files before a batch starts", async () => {
      expect(await checkLocalImage("batch", "p1/a.jpg")).toMatchObject({ ok: true, mediaType: "image/jpeg", busy: false })
      expect(await checkLocalImage("batch", "p1/fresh.jpg")).toMatchObject({ ok: true, busy: true })
      expect(await checkLocalImage("batch", "p1/missing.jpg")).toMatchObject({ ok: false })
      expect(await checkLocalImage("batch", "p1/fake.jpg")).toMatchObject({ ok: false })
      expect(await checkLocalImage("batch", "p1")).toMatchObject({ ok: false })
    })

    it("asks to retry a file that may still be uploading", async () => {
      await expect(readLocalImage("batch", "p1/fresh.jpg")).rejects.toBeInstanceOf(RetryableException)
      await expect(readLocalImage("batch", "p1/fake.jpg")).rejects.toThrow("Desteklenmeyen")
    })

    it("names local images by content hash and keeps the order", async () => {
      const set = await buildImageSet(["p1/b.png", "p1/a.jpg"], "batch")
      const again = await buildImageSet(["p1/b.png", "p1/a.jpg"], "batch")

      expect(set.sources).toHaveLength(2)
      expect(set.sources.every((source) => /^sha256:[0-9a-f]{64}$/.test(source))).toBe(true)
      expect(again.sources).toEqual(set.sources)
      expect((await set.load()).map((image) => image.mediaType)).toEqual(["image/png", "image/jpeg"])
    })
  })

  describe("helpers", () => {
    it("replaces only the plain prices of the document currencies", () => {
      const existing: PriceRow[] = [
        { id: "p_try", amount: 100, currency_code: "try", min_quantity: null, max_quantity: null, rules: {} },
        { id: "p_usd", amount: 3, currency_code: "usd", min_quantity: null, max_quantity: null, rules: {} },
        { id: "p_try_bulk", amount: 80, currency_code: "try", min_quantity: 10, max_quantity: null, rules: {} },
        { id: "p_try_tr", amount: 90, currency_code: "try", min_quantity: null, max_quantity: null, rules: { region_id: "reg" } },
      ]

      expect(
        mergeEntryPrices(existing, [
          { currency: "try", amount: "120.00", compareAt: null },
          { currency: "eur", amount: "4.00", compareAt: null },
        ])
      ).toEqual([
        { id: "p_usd", amount: 3, currency_code: "usd", rules: {} },
        { id: "p_try_bulk", amount: 80, currency_code: "try", min_quantity: 10, rules: {} },
        { id: "p_try_tr", amount: 90, currency_code: "try", rules: { region_id: "reg" } },
        { id: "p_try", amount: 120, currency_code: "try" },
        { amount: 4, currency_code: "eur" },
      ])
    })

    it("retries passing trouble and not bad data", () => {
      expect(isRetryable(new RetryableException("busy"))).toBe(true)
      expect(isRetryable(new HttpStatusException(503, "down"))).toBe(true)
      expect(isRetryable(new HttpStatusException(404, "gone"))).toBe(false)
      expect(isRetryable(new ImportException("bad"))).toBe(false)
      expect(isRetryable(new MedusaError(MedusaError.Types.INVALID_DATA, "bad"))).toBe(false)
      expect(isRetryable(new Error("deadlock"))).toBe(true)
    })

    it("hashes documents regardless of key order", () => {
      expect(stableJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(stableJson({ a: [{ c: 3, d: 2 }], b: 1 }))
      expect(stableJson({ a: undefined, b: null })).toBe('{"b":null}')
    })

    it("matches document locales to store locales", () => {
      expect(matchLocale("en", ["tr-TR", "en-US"])).toBe("en-US")
      expect(matchLocale("EN-us", ["en-US"])).toBe("en-US")
      expect(matchLocale("de", ["tr-TR", "en-US"])).toBeNull()
    })

    it("finds categories by id, handle or name path", () => {
      const index: CategoryIndex = {
        byId: new Map([["pcat_1", "pcat_1"]]),
        byHandle: new Map([["elbise", "pcat_1"]]),
        byPath: new Map([["kadın\u0000giyim\u0000elbise", "pcat_1"]]),
      }

      expect(resolveCategories(index, ["Elbise"]).value).toEqual(["pcat_1"])
      expect(resolveCategories(index, [{ path: ["Kadın", "Giyim", "Elbise"] }]).value).toEqual(["pcat_1"])
      expect(resolveCategories(index, ["Kadın > Giyim > Elbise"]).value).toEqual(["pcat_1"])
      expect(resolveCategories(index, [{ handle: "yok" }])).toEqual({
        value: [],
        warnings: ["Kategori bulunamadı: yok"],
      })
    })
  })
})
