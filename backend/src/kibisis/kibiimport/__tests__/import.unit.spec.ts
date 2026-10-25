import { categoryPaths } from "../lib/categories"
import { TrendyolAdapter } from "../sources/trendyol/adapter"
import { jsonObject } from "../sources/trendyol/parse"
import { roundMoney } from "../money"
import { productHost, splitProductUrls } from "../lib/urls"

const product = {
  id: 99,
  name: "Siyah Babet",
  productGroupId: 50,
  productCode: "NX-1",
  brand: { name: "Nexs" },
  tax: 10,
  attributes: [
    { key: { name: "Renk" }, value: { name: "Siyah" } },
    { key: { name: "Materyal" }, value: { name: "Deri" } },
  ],
  images: ["https://cdn.example/1.jpg", "https://cdn.example/1.jpg", "http://cdn.example/2.jpg"],
  variants: [
    { value: "36", barcode: "111", price: { value: 100 }, itemNumber: "A" },
    { value: "37", barcode: "222", price: { value: 100.005 } },
  ],
  merchantListing: {
    winnerVariant: {
      price: {
        currency: "try",
        sellingPrice: { value: 90 },
        originalPrice: { value: 120 },
      },
      variantAttributes: [{ attributeName: "Beden" }],
    },
  },
}

describe("kibiimport", () => {
  it("labels categories by parent path and sibling rank", () => {
    expect(
      categoryPaths([
        { id: "shoes", name: "Ayakkabı", parentId: "women", rank: 1 },
        { id: "bags", name: "Çanta", parentId: "women", rank: 2 },
        { id: "sport", name: "Spor", parentId: "shoes", rank: 0 },
        { id: "women", name: "Kadın", parentId: null, rank: 1 },
        { id: "men", name: "Erkek", parentId: null, rank: 0 },
        { id: "orphan", name: "Ayakkabı", parentId: "missing", rank: 0 },
        { id: "loop-a", name: "A", parentId: "loop-b", rank: 0 },
        { id: "loop-b", name: "B", parentId: "loop-a", rank: 0 },
      ])
    ).toEqual([
      { id: "orphan", name: "Ayakkabı" },
      { id: "men", name: "Erkek" },
      { id: "women", name: "Kadın" },
      { id: "shoes", name: "Kadın / Ayakkabı" },
      { id: "sport", name: "Kadın / Ayakkabı / Spor" },
      { id: "bags", name: "Kadın / Çanta" },
      { id: "loop-a", name: "A" },
      { id: "loop-b", name: "A / B" },
    ])
  })

  it("splits one product link per line", () => {
    expect(splitProductUrls(" https://a.test \n\nhttps://b.test \r\n")).toEqual([
      "https://a.test",
      "https://b.test",
    ])
  })

  it("reads the host without www", () => {
    expect(productHost("https://www.trendyol.com/marka/urun-p-1")).toBe("trendyol.com")
  })

  it("rounds half up to two decimals", () => {
    expect(roundMoney("100.005")).toBe("100.01")
    expect(roundMoney("1.004")).toBe("1.00")
    expect(roundMoney("-1")).toBeNull()
  })

  it("extracts a json object with strings", () => {
    const html = 'window["__envoy__SHARED_PROPS"]={"name":"a}b","n":1}'
    expect(jsonObject(html, html.indexOf("{"))).toBe('{"name":"a}b","n":1}')
  })

  it("maps a trendyol product to variants and shared attributes", () => {
    const imported = new TrendyolAdapter().adapt("https://www.trendyol.com/nexs/babet-p-99", {
      culture: "tr-TR",
      product,
    })

    expect(imported.code).toBe("ty-50")
    expect(imported.color).toBe("Siyah")
    expect(imported.currency).toBe("TRY")
    expect(imported.attributes).toEqual([{ name: "Materyal", value: "Deri" }])
    expect(imported.images).toEqual(["https://cdn.example/1.jpg"])
    expect(imported.variants.map((variant) => variant.barcode)).toEqual(["111", "222"])
    expect(imported.variants[0]?.price).toBe("100.00")
    expect(imported.variants[1]?.price).toBe("100.01")
    expect(imported.variants[0]?.compareAtPrice).toBe("120.00")
    expect(imported.variants[0]?.attributes).toEqual([{ name: "Beden", value: "36" }])
  })

  it("refuses a link whose product id does not match", () => {
    expect(() =>
      new TrendyolAdapter().adapt("https://www.trendyol.com/nexs/babet-p-100", {
        product,
      })
    ).toThrow("eşleşmiyor")
  })
})
