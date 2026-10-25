import { model } from "@medusajs/framework/utils"

const ImportProduct = model
  .define("kibiimport_product", {
    id: model.id({ prefix: "kipr" }).primaryKey(),
    source: model.text(),
    code: model.text(),
    color: model.text(),
    product_id: model.text(),
  })
  .indexes([
    {
      on: ["code", "color"],
      unique: true,
    },
    {
      on: ["product_id"],
    },
  ])

export default ImportProduct
