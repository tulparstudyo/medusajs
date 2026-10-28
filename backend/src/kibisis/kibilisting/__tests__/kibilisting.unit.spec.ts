import { parseListingQuery } from "../query"

const channels = ["sc_1"]

describe("kibilisting", () => {
  it("groups option tokens by title", () => {
    const query = parseListingQuery(
      {
        category_id: ["pcat_1"],
        currency_code: "TRY",
        option: ["Beden:M", "Beden:L", "Renk:Kırmızı", "Beden:M", "bozuk", ":L"],
      },
      channels
    )

    expect(query.currencyCode).toBe("try")
    expect(query.options).toEqual([
      { title: "Beden", values: ["M", "L"] },
      { title: "Renk", values: ["Kırmızı"] },
    ])
  })

  it("reads single values as one-item lists", () => {
    const query = parseListingQuery(
      { category_id: "pcat_1", collection_id: "pcol_1", currency_code: "try" },
      channels
    )

    expect(query.categoryIds).toEqual(["pcat_1"])
    expect(query.collectionIds).toEqual(["pcol_1"])
  })

  it("falls back to safe paging and sorting", () => {
    const query = parseListingQuery(
      {
        category_id: ["pcat_1"],
        currency_code: "try",
        sort: "title",
        limit: "5000",
        offset: "-3",
        q: "  ",
      },
      channels
    )

    expect(query.sort).toBe("created_at")
    expect(query.limit).toBe(100)
    expect(query.offset).toBe(0)
    expect(query.q).toBeUndefined()
  })

  it("rejects a malformed currency", () => {
    expect(() =>
      parseListingQuery({ category_id: ["pcat_1"], currency_code: "tr;" }, channels)
    ).toThrow("currency_code")
  })
})
