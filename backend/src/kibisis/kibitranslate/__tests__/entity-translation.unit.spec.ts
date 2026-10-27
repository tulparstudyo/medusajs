import {
  buildTranslationBatch,
  collectEntityUnits,
  EntityGroup,
  mergeEntityTranslations,
} from "../admin/entity-translation-job"

const groups: EntityGroup[] = [
  {
    type: "product",
    fields: ["title", "subtitle", "description"],
    records: [
      {
        id: "prod_1",
        title: "Kırmızı Elbise",
        subtitle: "",
        description: "<p>Yazlık <b>elbise</b></p>",
        translations: [
          {
            id: "tr_1",
            reference_id: "prod_1",
            reference: "product",
            locale_code: "en-US",
            translations: { title: "Red Dress" },
          },
        ],
      },
    ],
  },
  {
    type: "product_option_value",
    fields: ["value"],
    records: [
      { id: "optval_1", value: "Kırmızı", translations: [] },
      { id: "optval_2", value: "Mavi" },
    ],
  },
]

describe("entity translation job", () => {
  it("collects untranslated, non-empty fields and marks html", () => {
    const units = collectEntityUnits(groups, "en-US", false)

    expect(units.map((unit) => unit.text)).toEqual([
      "<p>Yazlık <b>elbise</b></p>",
      "Kırmızı",
      "Mavi",
    ])
    expect(units[0].format).toBe("html")
    expect(units[1].format).toBe("text")
    expect(collectEntityUnits(groups, "en-us", true)).toHaveLength(4)
    expect(collectEntityUnits(groups, "de-DE", false)).toHaveLength(4)
  })

  it("updates existing locale records and creates missing ones", () => {
    const units = collectEntityUnits(groups, "en-US", true)
    const results = units.map((unit) => ({ key: unit.key, text: `EN:${unit.text}` }))
    const batch = buildTranslationBatch(groups, "en-US", results)

    expect(batch.update).toEqual([
      {
        id: "tr_1",
        translations: {
          title: "EN:Kırmızı Elbise",
          description: "EN:<p>Yazlık <b>elbise</b></p>",
        },
      },
    ])
    expect(batch.create).toEqual([
      {
        reference_id: "optval_1",
        reference: "product_option_value",
        locale_code: "en-US",
        translations: { value: "EN:Kırmızı" },
      },
      {
        reference_id: "optval_2",
        reference: "product_option_value",
        locale_code: "en-US",
        translations: { value: "EN:Mavi" },
      },
    ])
  })

  it("merges saved records so later runs see them", () => {
    const merged = mergeEntityTranslations(groups, [
      {
        id: "tr_9",
        reference_id: "optval_2",
        reference: "product_option_value",
        locale_code: "en-US",
        translations: { value: "Blue" },
      },
    ])

    const units = collectEntityUnits(merged, "en-US", false).map((unit) => unit.text)
    expect(units).not.toContain("Mavi")
    expect(units).toContain("Kırmızı")
  })
})
