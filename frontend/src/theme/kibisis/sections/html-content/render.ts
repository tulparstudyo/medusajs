import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

function escapeAttr(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function stripScripts(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
}

export function renderHtmlContent(
  instanceId: string,
  settings: Record<string, unknown> | null | undefined
) {
  const raw = typeof settings?.html === "string" ? settings.html.trim() : ""
  if (!raw) {
    return ""
  }

  const template = readFileSync(
    path.join(process.cwd(), "src/theme/kibisis/sections/html-content/index.html"),
    "utf8"
  )

  const html = stripScripts(raw)

  return template
    .replaceAll("{{dom_id}}", escapeAttr(instanceId))
    .replaceAll("{{instance_id}}", escapeAttr(instanceId))
    .replace("{{html}}", html)
}
