import { model } from "@medusajs/framework/utils"

const PageSection = model
  .define("kibipage_section", {
    id: model.id({ prefix: "ksec" }).primaryKey(),
    page_id: model.text(),
    type: model.text(),
    name: model.text().default(""),
    position: model.number().default(0),
    is_active: model.boolean().default(true),
    settings: model.json().nullable(),
  })
  .indexes([
    {
      on: ["page_id", "position"],
    },
  ])

export default PageSection
