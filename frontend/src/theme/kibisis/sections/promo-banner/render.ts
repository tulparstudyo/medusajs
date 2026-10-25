import { themeIconHtml } from "../../icon-html"
import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

const LAYOUTS = new Set(["grid", "slider", "list"])
const TONES = new Set(["stone", "amber", "indigo", "purple", "rose"])

type Item = {
  eyebrow: string
  title: string
  text: string
  action: string
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

function part(template: string, name: string) {
  const match = template.match(
    new RegExp(`<template data-part="${name}">([\\s\\S]*?)</template>`)
  )
  return match?.[1] ?? ""
}

function clamp(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : fallback
  if (!Number.isFinite(number)) {
    return fallback
  }
  return Math.min(6, Math.max(1, Math.trunc(number)))
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
    const href = typeof row.href === "string" ? row.href.trim() : ""
    if (!title || !href) {
      continue
    }
    const tone = typeof row.tone === "string" && TONES.has(row.tone) ? row.tone : "stone"
    items.push({
      eyebrow: typeof row.eyebrow === "string" ? row.eyebrow : "",
      title,
      text: typeof row.text === "string" ? row.text : "",
      action: typeof row.action === "string" ? row.action : "",
      href,
      tone,
    })
  }
  return items
}

export function renderPromoBanner(instanceId: string, settings: unknown) {
  const source =
    settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {}
  const items = readItems(source.items)
  if (!items.length) {
    return null
  }

  const layout =
    typeof source.layout === "string" && LAYOUTS.has(source.layout) ? source.layout : "grid"
  const template = readFileSync(
    path.join(process.cwd(), "src/theme/kibisis/sections/promo-banner/index.html"),
    "utf8"
  )
  const itemTemplate = part(template, "item")
  const renderedItems = items
    .map((item) =>
      itemTemplate
        .replaceAll("{{tone}}", item.tone)
        .replaceAll("{{href}}", escapeHtml(item.href))
        .replaceAll("{{eyebrow}}", escapeHtml(item.eyebrow))
        .replaceAll("{{title}}", escapeHtml(item.title))
        .replaceAll("{{text}}", escapeHtml(item.text))
        .replaceAll("{{action}}", escapeHtml(item.action))
    )
    .join("")

  const controls = part(template, "controls")
    .replaceAll("{{prev}}", themeIconHtml("chevron-left", "kibi-icon"))
    .replaceAll("{{next}}", themeIconHtml("chevron-right", "kibi-icon"))

  return template
    .replace(/<template data-part="[\s\S]*?<\/template>/g, "")
    .replaceAll("{{controls}}", layout === "slider" ? controls : "")
    .replaceAll("{{items}}", renderedItems)
    .replaceAll("{{layout}}", layout)
    .replaceAll("{{columns}}", String(clamp(source.columns, 3)))
    .replaceAll("{{visible}}", String(clamp(source.visible, 1)))
    .replaceAll("{{instance_id}}", escapeHtml(instanceId))
    .replaceAll("{{dom_id}}", escapeHtml(instanceId))
}
