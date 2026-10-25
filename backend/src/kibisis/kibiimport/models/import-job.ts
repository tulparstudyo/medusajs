import { model } from "@medusajs/framework/utils"

const ImportJob = model
  .define("kibiimport_job", {
    id: model.id({ prefix: "kimp" }).primaryKey(),
    url: model.text(),
    category_id: model.text(),
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
  ])

export default ImportJob
