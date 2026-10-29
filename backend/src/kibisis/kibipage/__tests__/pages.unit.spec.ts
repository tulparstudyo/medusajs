import {
  defaultPageLabel,
  isPageKey,
  isSystemPageKey,
  KIBI_PAGE_KEYS,
  slugifyPageKey,
} from "../types"
import { CreatePageSchema, SelectedProductSettingsSchema } from "../validators"

describe("kibipage page helpers and validators", () => {
  it("converts Turkish titles into valid page keys", () => {
    expect(slugifyPageKey("Kargo ve Teslimat")).toBe("kargo-ve-teslimat")
    expect(slugifyPageKey("Çerez & Gizlilik İlkeleri!")).toBe(
      "cerez-gizlilik-ilkeleri"
    )
    expect(slugifyPageKey("  İade / Değişim Koşulları  ")).toBe(
      "iade-degisim-kosullari"
    )
  })

  it("validates dynamic page keys and system page keys", () => {
    for (const key of KIBI_PAGE_KEYS) {
      expect(isPageKey(key)).toBe(true)
    }

    expect(isPageKey("kargo-ve-teslimat")).toBe(true)
    expect(isPageKey("Bad_Key")).toBe(false)
    expect(isPageKey("-leading")).toBe(false)
    expect(isPageKey("")).toBe(false)

    expect(isSystemPageKey("home")).toBe(true)
    expect(isSystemPageKey("product")).toBe(true)
    expect(isSystemPageKey("about")).toBe(false)
    expect(defaultPageLabel("home")).toBe("Ana Sayfa")
    expect(defaultPageLabel("ozel-sayfa")).toBe("ozel-sayfa")
  })

  it("validates CreatePageSchema payloads", () => {
    const valid = CreatePageSchema.safeParse({
      page_key: "kargo-ve-teslimat",
      label: "Kargo ve Teslimat",
    })
    expect(valid.success).toBe(true)

    const invalid = CreatePageSchema.safeParse({
      page_key: "Kargo Teslimat",
      label: "",
    })
    expect(invalid.success).toBe(false)
  })

  it("validates SelectedProductSettingsSchema image dimensions", () => {
    const defaults = SelectedProductSettingsSchema.parse({})
    expect(defaults.image_width).toBe(0)
    expect(defaults.image_height).toBe(0)

    const withDims = SelectedProductSettingsSchema.parse({
      title: "Öne Çıkanlar",
      source: "new",
      limit: 8,
      image_width: 320,
      image_height: 400,
    })
    expect(withDims.image_width).toBe(320)
    expect(withDims.image_height).toBe(400)
  })
})

