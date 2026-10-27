import { model } from "@medusajs/framework/utils"

/**
 * One translated text. `hash` identifies the source text in its language
 * pair and format, so the same text is never sent to a provider twice.
 */
const TranslationMemory = model
  .define("kibitranslate_memory", {
    id: model.id({ prefix: "ktm" }).primaryKey(),
    hash: model.text(),
    source_locale: model.text(),
    target_locale: model.text(),
    format: model.text().default("text"),
    source_text: model.text(),
    translated_text: model.text(),
    provider: model.text().default(""),
    edited: model.boolean().default(false),
    hits: model.number().default(0),
    last_used_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["hash"],
      unique: true,
    },
    {
      on: ["source_locale", "target_locale"],
    },
  ])

export default TranslationMemory
