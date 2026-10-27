import {
  isUnfiltered,
  PRODUCT_OPTION_TABLE_QUERY,
  PRODUCT_TABLE_QUERY,
  tableListQuery,
} from "../admin/table-query"

describe("tableListQuery", () => {
  it("copies the product table filters and drops paging and sorting", () => {
    const table = new URLSearchParams({
      q: " elbise ",
      status: "published,draft",
      tag_id: "ptag_1",
      created_at: JSON.stringify({ $gte: "2026-10-01T00:00:00.000Z" }),
      offset: "40",
      order: "-created_at",
    })

    const query = tableListQuery(table, PRODUCT_TABLE_QUERY)

    expect(query.get("q")).toBe("elbise")
    expect(query.getAll("status[]")).toEqual(["published", "draft"])
    expect(query.getAll("tag_id[]")).toEqual(["ptag_1"])
    expect(query.get("created_at[$gte]")).toBe("2026-10-01T00:00:00.000Z")
    expect(query.has("offset")).toBe(false)
    expect(query.has("order")).toBe(false)
    expect(isUnfiltered(query)).toBe(false)
  })

  it("treats a table without filters as unfiltered and ignores broken dates", () => {
    const query = tableListQuery(
      new URLSearchParams({ offset: "20", created_at: "{oops" }),
      PRODUCT_TABLE_QUERY
    )

    expect(isUnfiltered(query)).toBe(true)
  })

  it("reads plain and JSON encoded booleans and ignores filters the table does not have", () => {
    const spec = PRODUCT_OPTION_TABLE_QUERY

    expect(tableListQuery(new URLSearchParams({ is_exclusive: "false" }), spec).get("is_exclusive")).toBe("false")
    expect(tableListQuery(new URLSearchParams({ is_exclusive: '"true"' }), spec).get("is_exclusive")).toBe("true")
    expect(tableListQuery(new URLSearchParams({ is_exclusive: "maybe" }), spec).has("is_exclusive")).toBe(false)
    expect(tableListQuery(new URLSearchParams({ status: "draft" }), spec).has("status[]")).toBe(false)
  })
})
