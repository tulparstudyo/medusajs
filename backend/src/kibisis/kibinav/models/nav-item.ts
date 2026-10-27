import { model } from "@medusajs/framework/utils"

const NavItem = model
  .define("kibinav_item", {
    id: model.id({ prefix: "knav" }).primaryKey(),
    menu: model.enum(["main", "footer", "top", "bottom"]).default("main"),
    align: model.enum(["start", "end"]).default("start"),
    label: model.text().translatable(),
    parent_id: model.text().nullable(),
    position: model.number().default(0),
    target_type: model.enum(["category", "url", "anchor"]),
    category_id: model.text().nullable(),
    url: model.text().nullable(),
    anchor: model.text().nullable(),
    new_tab: model.boolean().default(false),
    is_active: model.boolean().default(true),
  })
  .indexes([
    {
      on: ["menu", "parent_id", "position"],
    },
  ])

export default NavItem
