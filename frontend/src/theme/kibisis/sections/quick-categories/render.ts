import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

import { themeIconHtml } from "../../icon-html"

const TONES = new Set([
  "rose",
  "blue",
  "amber",
  "emerald",
  "indigo",
  "amber-dark",
  "stone",
  "pink",
  "orange",
  "slate",
  "cyan",
  "purple",
])

const ITEM_BLOCK = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/

type Item = {
  icon: string
  title: string
  label: string
  href: string
  tone: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function readItems(settings: unknown): Item[] {
  if (!settings || typeof settings !== "object" || !("items" in settings)) {
    return []
  }

  const items = (settings as { items?: unknown }).items
  if (!Array.isArray(items)) {
    return []
  }

  const parsed: Item[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue
    }

    const row = item as Record<string, unknown>
    const tone = typeof row.tone === "string" && TONES.has(row.tone) ? row.tone : ""
    const title = typeof row.title === "string" ? row.title : ""
    const label = typeof row.label === "string" ? row.label : ""
    const href = typeof row.href === "string" ? row.href : ""
    const icon = typeof row.icon === "string" ? row.icon : ""
    if (!tone || !title || !label || !href) {
      continue
    }

    parsed.push({ icon, title, label, href, tone })
  }

  return parsed
}

export function renderQuickCategories(instanceId: string, settings: unknown) {
  const items = readItems(settings)
  if (!items.length) {
    return null
  }

  const template = readFileSync(
    path.join(
      process.cwd(),
      "src/theme/kibisis/sections/quick-categories/index.html"
    ),
    "utf8"
  )
  const match = template.match(ITEM_BLOCK)
  if (!match) {
    throw new Error("quick-categories şablonunda {{#items}} bloğu yok.")
  }

  const rendered = items
    .map((item) =>
      match[1]
        .replaceAll("{{icon}}", themeIconHtml(item.icon, "kibi-icon"))
        .replaceAll("{{title}}", escapeHtml(item.title))
        .replaceAll("{{label}}", escapeHtml(item.label))
        .replaceAll("{{href}}", escapeHtml(item.href))
        .replaceAll("{{tone}}", item.tone)
    )
    .join("")

  return template
    .replace(ITEM_BLOCK, rendered)
    .replaceAll("{{instance_id}}", escapeHtml(instanceId))
}
