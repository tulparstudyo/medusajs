import { model } from "@medusajs/framework/utils"

const PageRecord = model
  .define("kibipage", {
    id: model.id({ prefix: "kpage" }).primaryKey(),
    page_key: model.text(),
    label: model.text().default(""),
  })
  .indexes([
    {
      on: ["page_key"],
      unique: true,
    },
  ])

export default PageRecord
