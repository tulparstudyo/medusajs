import { model } from "@medusajs/framework/utils"

import { ITEM_STATUSES } from "../types"

const Item = model
  .define("kibijson_item", {
    id: model.id({ prefix: "kji" }).primaryKey(),
    batch_id: model.text(),
    position: model.number(),
    external_id: model.text(),
    code: model.text(),
    color: model.text(),
    title: model.text(),
    payload: model.json(),
    payload_sha256: model.text(),
    fingerprint: model.text().nullable(),
    category_ids: model.array().nullable(),
    status: model.enum([...ITEM_STATUSES]).default("pending"),
    attempts: model.number().default(0),
    max_attempts: model.number().default(3),
    next_run_at: model.dateTime().nullable(),
    locked_until: model.dateTime().nullable(),
    locked_by: model.text().nullable(),
    product_id: model.text().nullable(),
    created: model.boolean().nullable(),
    result: model.json().nullable(),
    warnings: model.json().nullable(),
    error: model.text().nullable(),
    started_at: model.dateTime().nullable(),
    finished_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["status", "next_run_at", "created_at"],
    },
    {
      on: ["batch_id", "position"],
    },
    {
      on: ["batch_id", "code", "color"],
      unique: true,
    },
    {
      on: ["code", "color", "status"],
    },
  ])

export default Item
