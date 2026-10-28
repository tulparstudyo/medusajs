import { themeIconHtml } from "../../icon-html"
import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

const VARIANTS = new Set(["outline", "pill"])

type Item = {
  label: string
  href: string
  icon: string
  accent: boolean
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function isImageIcon(value: string) {
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith("/") ||
    /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(value)
  )
}

function linkIconHtml(icon: string, className: string) {
  const value = icon.trim()
  if (!value) {
    return ""
  }
  if (isImageIcon(value)) {
    return `<img class="${className}" src="${escapeHtml(value)}" alt="" aria-hidden="true" />`
  }
  return themeIconHtml(value, className)
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
    const label = typeof row.label === "string" ? row.label.trim() : ""
    const href = typeof row.href === "string" ? row.href.trim() : ""
    if (!label || !href) {
      continue
    }
    const icon = typeof row.icon === "string" ? row.icon : ""
    items.push({ label, href, icon, accent: row.accent === true })
  }
  return items
}

export function renderFastLinks(instanceId: string, settings: unknown) {
  const source =
    settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {}
  const items = readItems(source.items)
  if (!items.length) {
    return null
  }

  const variant =
    typeof source.variant === "string" && VARIANTS.has(source.variant) ? source.variant : "outline"
  const title = typeof source.title === "string" ? source.title.trim() : ""
  const template = readFileSync(
    path.join(process.cwd(), "src/theme/kibisis/sections/fast-links/index.html"),
    "utf8"
  )
  const itemTemplate = part(template, "item")
  const renderedItems = items
    .map((item) =>
      itemTemplate
        .replaceAll("{{accent}}", item.accent ? "is-accent" : "")
        .replaceAll("{{href}}", escapeHtml(item.href))
        .replaceAll("{{icon}}", linkIconHtml(item.icon, "kibi-icon"))
        .replaceAll("{{label}}", escapeHtml(item.label))
        .replaceAll(
          "{{mark}}",
          item.accent ? themeIconHtml("chevron-down", "kibi-icon") : ""
        )
    )
    .join("")
  const head = title
    ? part(template, "head").replaceAll("{{title}}", escapeHtml(title))
    : ""

  return template
    .replace(/<template data-part="[\s\S]*?<\/template>/g, "")
    .replaceAll("{{head}}", head)
    .replaceAll("{{items}}", renderedItems)
    .replaceAll("{{variant}}", variant)
    .replaceAll("{{instance_id}}", escapeHtml(instanceId))
    .replaceAll("{{dom_id}}", escapeHtml(instanceId))
}
