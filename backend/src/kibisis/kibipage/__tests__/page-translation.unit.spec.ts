import {
  applySectionResults,
  collectPageUnits,
  collectSectionUnits,
  splitPageResults,
} from "../admin/section-translation-job"
import { cleanTranslations } from "../lib/translations"

const sections = [
  {
    id: "sec_links",
    type: "fast-links",
    settings: {
      title: "Popüler Aramalar",
      items: [
        { id: "a", label: "Robot Süpürge" },
        { id: "b", label: "Kindle" },
      ],
      translations: { en: { fields: { title: "Popular Searches" } } },
    },
  },
  {
    id: "sec_boxes",
    type: "icon-box",
    settings: { items: [{ id: "box-1", title: "Yarın Kapında", text: "Hızlı teslimat." }] },
  },
  { id: "sec_unknown", type: "legacy", settings: { title: "Eski" } },
]

describe("page translation job", () => {
  it("collects untranslated texts from every translatable section", () => {
    const units = collectPageUnits(sections, "en", false)
    const texts = units.map((unit) => unit.text)

    expect(texts).toEqual(["Robot Süpürge", "Kindle", "Yarın Kapında", "Hızlı teslimat."])
    expect(texts).not.toContain("Popüler Aramalar")
    expect(texts).not.toContain("Eski")
  })

  it("includes translated texts when overwriting", () => {
    const texts = collectPageUnits(sections, "en", true).map((unit) => unit.text)

    expect(texts).toContain("Popüler Aramalar")
    expect(collectPageUnits(sections, "de", false)).toHaveLength(5)
  })

  it("marks html-content fields with html format and preserves long html translations", () => {
    const longHtml = `<article>${"<p>Çerez politikası metni.</p>\n".repeat(1200)}</article>`
    const units = collectSectionUnits("html-content", { html: longHtml }, {}, false)

    expect(units).toHaveLength(1)
    expect(units[0].format).toBe("html")

    const cleaned = cleanTranslations(
      "html-content",
      { html: longHtml },
      { en: { fields: { html: longHtml } } }
    )
    expect(cleaned?.en?.fields?.html).toBe(longHtml)
  })

  it("routes results back to their sections", () => {
    const units = collectPageUnits(sections, "en", true)
    const results = units.map((unit) => ({ key: unit.key, text: `EN ${unit.text}` }))
    const bySection = splitPageResults(results)

    expect([...bySection.keys()]).toEqual(["sec_links", "sec_boxes"])

    const links = applySectionResults(
      sections[0].settings.translations!.en,
      bySection.get("sec_links")!
    )
    expect(links.fields).toEqual({ title: "EN Popüler Aramalar" })
    expect(links.lists).toEqual({
      items: { a: { label: "EN Robot Süpürge" }, b: { label: "EN Kindle" } },
    })

    const boxes = applySectionResults({}, bySection.get("sec_boxes")!)
    expect(boxes.lists).toEqual({
      items: { "box-1": { title: "EN Yarın Kapında", text: "EN Hızlı teslimat." } },
    })
  })
})
