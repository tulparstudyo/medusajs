import { model } from "@medusajs/framework/utils"

const ImportJob = model
  .define("kibiimport_job", {
    id: model.id({ prefix: "kimp" }).primaryKey(),
    url: model.text(),
    category_id: model.text(),
    location_ids: model.array().nullable(),
    currency_code: model.text().nullable(),
    parent_id: model.text().nullable(),
    status: model.enum(["pending", "processing", "completed", "failed"]).default("pending"),
    result: model.text().nullable(),
    exit_code: model.number().nullable(),
    started_at: model.dateTime().nullable(),
    finished_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["status", "created_at"],
    },
    {
      on: ["parent_id"],
    },
  ])

export default ImportJob
