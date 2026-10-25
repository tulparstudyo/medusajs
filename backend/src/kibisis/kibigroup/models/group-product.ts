import { model } from "@medusajs/framework/utils"

const GroupProduct = model
  .define("kibigroup_product", {
    id: model.id({ prefix: "kgrp" }).primaryKey(),
    product_id: model.text(),
    main_code: model.text(),
    color: model.text(),
    color_hex: model.text().nullable(),
    position: model.number().default(0),
  })
  .indexes([
    {
      on: ["product_id"],
      unique: true,
    },
    {
      on: ["main_code"],
    },
  ])

export default GroupProduct
