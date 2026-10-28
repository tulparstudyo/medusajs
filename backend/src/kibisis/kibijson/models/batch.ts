import { model } from "@medusajs/framework/utils"

import { BATCH_STATUSES } from "../types"

const Batch = model
  .define("kibijson_batch", {
    id: model.id({ prefix: "kjb" }).primaryKey(),
    name: model.text(),
    source: model.text(),
    schema: model.text(),
    payload_sha256: model.text(),
    image_base: model.text().nullable(),
    status: model.enum([...BATCH_STATUSES]).default("ready"),
    category_id: model.text().nullable(),
    location_ids: model.array().nullable(),
    currency_code: model.text().nullable(),
    options: model.json().nullable(),
    report: model.json().nullable(),
    total: model.number().default(0),
    pending: model.number().default(0),
    completed: model.number().default(0),
    failed: model.number().default(0),
    skipped: model.number().default(0),
    created_by: model.text().nullable(),
    started_at: model.dateTime().nullable(),
    finished_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["status", "created_at"],
    },
    {
      on: ["payload_sha256"],
    },
  ])

export default Batch
