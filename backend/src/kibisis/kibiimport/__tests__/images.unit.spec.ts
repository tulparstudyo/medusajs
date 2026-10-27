import { isLegacyImportFile, referencedPaths, selectOrphans, StoredFile } from "../cleanup"
import { imageFilename, imageFolder, sameSources, storedImagesOf } from "../images"

describe("kibiimport images", () => {
  it("groups uploads in a year-month folder under products", () => {
    expect(imageFolder(new Date(2026, 9, 27))).toBe("products/2026-10")
    expect(imageFolder(new Date(2027, 0, 1))).toBe("products/2027-01")
  })

  it("names a file after the product code and its position", () => {
    expect(imageFilename("products/2026-10", "TY-904800244", 0, "image/webp")).toBe(
      "products/2026-10/ty-904800244-1.webp"
    )
    expect(imageFilename("products/2026-10", "ty-1", 2, "image/x-unknown")).toBe(
      "products/2026-10/ty-1-3.jpg"
    )
  })

  it("reads stored image sources and keys from product metadata", () => {
    expect(
      storedImagesOf({
        kibiimport: { code: "ty-1", image_sources: ["https://a/1.jpg"], image_keys: ["products/2026-10/1-ty-1-1.jpg"] },
      })
    ).toEqual({ sources: ["https://a/1.jpg"], keys: ["products/2026-10/1-ty-1-1.jpg"] })
    expect(storedImagesOf({ kibiimport: { code: "ty-1" } })).toBeNull()
    expect(storedImagesOf({ kibiimport: { image_sources: ["a"], image_keys: [1] } })).toBeNull()
    expect(storedImagesOf(null)).toBeNull()
  })

  it("compares source links in order", () => {
    expect(sameSources(["a", "b"], ["a", "b"])).toBe(true)
    expect(sameSources(["a", "b"], ["b", "a"])).toBe(false)
    expect(sameSources(["a"], ["a", "b"])).toBe(false)
    expect(sameSources([], [])).toBe(true)
  })
})

describe("kibiimport image cleanup", () => {
  const now = new Date("2026-10-27T12:00:00Z")
  const day = 24 * 60 * 60 * 1000
  const file = (key: string, ageDays: number): StoredFile => ({
    key,
    size: 10,
    modifiedAt: new Date(now.getTime() - ageDays * day),
  })

  it("collects image paths and their trailing parts from urls and json", () => {
    const paths = referencedPaths([
      JSON.stringify({ thumbnail: "http://localhost:9080/products/2026-10/17-ty-1-1.webp" }),
      '{"settings":{"image":"https://cdn.test/17-ty-2-1.jpg?v=1"}}',
      "http://cdn.test/products/2026-10/18-ty%2D3-1.png",
    ])

    expect(paths.has("products/2026-10/17-ty-1-1.webp")).toBe(true)
    expect(paths.has("17-ty-1-1.webp")).toBe(true)
    expect(paths.has("17-ty-2-1.jpg")).toBe(true)
    expect(paths.has("products/2026-10/18-ty-3-1.png")).toBe(true)
  })

  it("keeps referenced and recent files and returns the rest", () => {
    const references = new Set(["products/2026-10/1-ty-1-1.webp"])
    const result = selectOrphans(
      [
        file("products/2026-10/1-ty-1-1.webp", 30),
        file("products/2026-10/2-ty-1-1.webp", 1),
        file("products/2026-09/3-ty-1-1.webp", 30),
      ],
      references,
      7 * day,
      now
    )

    expect(result.referenced).toBe(1)
    expect(result.recent).toBe(1)
    expect(result.orphans.map((orphan) => orphan.key)).toEqual(["products/2026-09/3-ty-1-1.webp"])
  })

  it("treats only flat files of known import codes as legacy imports", () => {
    const slugs = new Set(["ty-904800244"])

    expect(isLegacyImportFile("1793121689804-ty-904800244-1.webp", slugs)).toBe(true)
    expect(isLegacyImportFile("1793121689804-ty-111-1.webp", slugs)).toBe(false)
    expect(isLegacyImportFile("1793121689804-banner-1.jpg", slugs)).toBe(false)
    expect(isLegacyImportFile("logo.png", slugs)).toBe(false)
  })
})
