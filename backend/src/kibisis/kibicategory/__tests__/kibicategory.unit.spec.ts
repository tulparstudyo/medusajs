import { planHandleRebuild, treeHandle } from "../handles"
import { ExistingCategory, planCategories } from "../plan"
import { CategoryDocumentSchema, toTree } from "../schema"

const defaults = { isActive: true, isInternal: false }

const existing: ExistingCategory[] = [
  { id: "kadin", name: "Kadın", handle: "kadın", parentId: null },
  { id: "elbise", name: "Elbise", handle: "elbise", parentId: "kadin" },
  { id: "giyim", name: "Giyim", handle: "giyim", parentId: "kadin" },
  { id: "kazak", name: "kazak", handle: "kazak", parentId: "giyim" },
  { id: "erkek-sweat", name: "Sweatshirt", handle: "sweatshirt", parentId: null },
]

function tree(document: unknown) {
  return toTree(CategoryDocumentSchema.parse(document))
}

describe("kibicategory", () => {
  it("reads the category / subcategories file format", () => {
    expect(
      tree([
        { category: "Giyim", subcategories: ["Elbise", " Kazak "] },
        { name: "Ayakkabı", children: [{ category: "Bot", subcategories: ["Kar Botu"] }] },
      ])
    ).toEqual([
      { name: "Giyim", children: [{ name: "Elbise", children: [] }, { name: "Kazak", children: [] }] },
      {
        name: "Ayakkabı",
        children: [{ name: "Bot", children: [{ name: "Kar Botu", children: [] }] }],
      },
    ])
  })

  it("merges siblings listed twice", () => {
    expect(
      tree({ categories: [{ category: "Çanta", subcategories: ["Cüzdan"] }, { category: "çanta", subcategories: ["Cüzdan", "Saat"] }] })
    ).toEqual([
      { name: "Çanta", children: [{ name: "Cüzdan", children: [] }, { name: "Saat", children: [] }] },
    ])
  })

  it("refuses empty names", () => {
    expect(CategoryDocumentSchema.safeParse([{ category: "", subcategories: [] }]).success).toBe(false)
    expect(CategoryDocumentSchema.safeParse([]).success).toBe(false)
  })

  it("reuses categories with the same name under the parent and creates the rest", () => {
    const plan = planCategories(
      tree([
        { category: "Giyim", subcategories: ["Elbise", "Kazak"] },
        { category: "Spor & Outdoor", subcategories: ["Sweatshirt", "Tişört"] },
      ]),
      existing,
      "kadin",
      defaults
    )

    expect(plan.map((entry) => [entry.path.join(" > "), entry.action, entry.handle, entry.id])).toEqual([
      ["Giyim", "exists", "giyim", "giyim"],
      ["Giyim > Elbise", "create", "kadin/giyim/elbise", null],
      ["Giyim > Kazak", "exists", "kazak", "kazak"],
      ["Spor & Outdoor", "create", "kadin/spor-outdoor", null],
      ["Spor & Outdoor > Sweatshirt", "create", "kadin/spor-outdoor/sweatshirt", null],
      ["Spor & Outdoor > Tişört", "create", "kadin/spor-outdoor/tisort", null],
    ])
    expect(plan[1]).toMatchObject({ parentId: "giyim", parentKey: null })
    expect(plan[4]).toMatchObject({ parentId: null, parentKey: plan[3]?.key })
  })

  it("numbers a tree handle that is taken and cleans a given handle", () => {
    const plan = planCategories(
      tree([
        { category: "Ayakkabı", subcategories: ["Bot"] },
        { category: "Çanta", handle: "Özel Çanta/Yeni Sezon!", subcategories: [] },
      ]),
      [{ id: "x", name: "Eski", handle: "ayakkabi/bot", parentId: null }],
      null,
      defaults
    )

    expect(plan.map((entry) => entry.handle)).toEqual(["ayakkabi", "ayakkabi/bot-2", "ozel-canta/yeni-sezon"])
  })

  it("sanitizes every segment of a tree handle", () => {
    expect(treeHandle(["Kadın", "Ev & İç Giyim", "Yağmurluk & Rüzgarlık"])).toBe(
      "kadin/ev-ic-giyim/yagmurluk-ruzgarlik"
    )
    expect(treeHandle(["Kadın", "&&&"])).toBe("kadin/kategori")
  })

  it("rebuilds handles of a subtree and leaves the rest alone", () => {
    expect(planHandleRebuild(existing, "kadin")).toEqual([
      { id: "kadin", name: "Kadın", path: ["Kadın"], from: "kadın", to: "kadin" },
      { id: "elbise", name: "Elbise", path: ["Kadın", "Elbise"], from: "elbise", to: "kadin/elbise" },
      { id: "giyim", name: "Giyim", path: ["Kadın", "Giyim"], from: "giyim", to: "kadin/giyim" },
      { id: "kazak", name: "kazak", path: ["Kadın", "Giyim", "kazak"], from: "kazak", to: "kadin/giyim/kazak" },
    ])
  })

  it("keeps handles that already follow the tree", () => {
    const tidy: ExistingCategory[] = [
      { id: "a", name: "Kadın", handle: "kadin", parentId: null },
      { id: "b", name: "Elbise", handle: "kadin/elbise", parentId: "a" },
    ]

    expect(planHandleRebuild(tidy, null)).toEqual([])
  })

  it("numbers a rebuilt handle held outside the scope", () => {
    const categories: ExistingCategory[] = [
      { id: "a", name: "Kadın", handle: "kadın", parentId: null },
      { id: "b", name: "Elbise", handle: "elbise", parentId: "a" },
      { id: "c", name: "Diğer", handle: "kadin/elbise", parentId: null },
    ]

    expect(planHandleRebuild(categories, "a").map((change) => change.to)).toEqual(["kadin", "kadin/elbise-2"])
  })

  it("plans top level categories when no parent is chosen", () => {
    const plan = planCategories(tree(["Kadın", "Erkek"]), existing, null, defaults)

    expect(plan.map((entry) => [entry.name, entry.action])).toEqual([
      ["Kadın", "exists"],
      ["Erkek", "create"],
    ])
  })
})
