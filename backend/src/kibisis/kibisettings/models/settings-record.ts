import { model } from "@medusajs/framework/utils"

const SettingsRecord = model
  .define("kibisettings", {
    id: model.id({ prefix: "kset" }).primaryKey(),
    settings_key: model.text(),
    values: model.json().nullable(),
  })
  .indexes([
    {
      on: ["settings_key"],
      unique: true,
    },
  ])

export default SettingsRecord
