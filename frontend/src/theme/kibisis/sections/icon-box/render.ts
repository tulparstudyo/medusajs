import { themeIconHtml } from "../../icon-html"
import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

const TONES = new Set([
  "orange",
  "blue",
  "emerald",
  "purple",
  "rose",
  "amber",
  "indigo",
  "slate",
])

type Item = {
  icon: string
  title: string
  text: string
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

function part(template: string, name: string) {
  const match = template.match(
    new RegExp(`<template data-part="${name}">([\\s\\S]*?)</template>`)
  )
  return match?.[1] ?? ""
}

function readItems(value: unknown): Item[] {
  if (!Array.isArray(value)) {
    return []
  }

  const items: Item[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue
    }
    const row = entry as Record<string, unknown>
    const title = typeof row.title === "string" ? row.title.trim() : ""
    const text = typeof row.text === "string" ? row.text.trim() : ""
    const icon = typeof row.icon === "string" ? row.icon : ""
    const tone = typeof row.tone === "string" && TONES.has(row.tone) ? row.tone : "orange"
    if (!title || !icon) {
      continue
    }
    items.push({ icon, title, text, tone })
  }
  return items
}

export function renderIconBox(instanceId: string, settings: unknown) {
  const source =
    settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {}
  const items = readItems(source.items)
  if (!items.length) {
    return null
  }

  const template = readFileSync(
    path.join(process.cwd(), "src/theme/kibisis/sections/icon-box/index.html"),
    "utf8"
  )
  const itemTemplate = part(template, "item")
  const renderedItems = items
    .map((item) =>
      itemTemplate
        .replaceAll("{{tone}}", item.tone)
        .replaceAll("{{icon}}", themeIconHtml(item.icon, "kibi-icon"))
        .replaceAll("{{title}}", escapeHtml(item.title))
        .replaceAll(
          "{{text}}",
          item.text ? `<p class="kibi-box__text">${escapeHtml(item.text)}</p>` : ""
        )
    )
    .join("")

  return template
    .replace(/<template data-part="[\s\S]*?<\/template>/g, "")
    .replaceAll("{{items}}", renderedItems)
    .replaceAll("{{instance_id}}", escapeHtml(instanceId))
    .replaceAll("{{dom_id}}", escapeHtml(instanceId))
}
