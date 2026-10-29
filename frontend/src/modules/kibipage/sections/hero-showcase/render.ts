import { themeIconHtml } from "@theme/kibisis/icon-html"
import { translateTemplate, type Translate } from "@theme/kibisis/i18n"
import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

type Slide = { image: string; href: string }
type Card = {
  eyebrow: string
  title: string
  text: string
  action: string
  href: string
  icon: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function isAddress(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true
  }

  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function readSlides(settings: unknown): Slide[] {
  if (!settings || typeof settings !== "object" || !("slides" in settings)) {
    return []
  }

  const slides = (settings as { slides?: unknown }).slides
  if (!Array.isArray(slides)) {
    return []
  }

  const parsed: Slide[] = []
  for (const slide of slides) {
    if (!slide || typeof slide !== "object") {
      continue
    }

    const row = slide as Record<string, unknown>
    const image = text(row.image).trim()
    const href = text(row.href).trim()
    if (!isAddress(image) || !isAddress(href)) {
      continue
    }

    parsed.push({ image, href })
  }

  return parsed
}

function readCard(value: unknown): Card | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const row = value as Record<string, unknown>
  const card = {
    eyebrow: text(row.eyebrow).trim(),
    title: text(row.title).trim(),
    text: text(row.text).trim(),
    action: text(row.action).trim(),
    href: text(row.href).trim(),
    icon: text(row.icon).trim(),
  }

  const hasCopy = card.eyebrow || card.title || card.text || card.action || card.icon
  if (!hasCopy) {
    return null
  }

  if (card.href && !isAddress(card.href)) {
    card.href = ""
  }

  return card
}

function part(template: string, name: string) {
  const match = template.match(
    new RegExp(`<template data-part="${name}">([\\s\\S]*?)<\\/template>`)
  )
  return match?.[1]?.trim() ?? ""
}

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  )
}

function cardHtml(template: string, card: Card) {
  const html = fill(template, {
    eyebrow: escapeHtml(card.eyebrow),
    title: escapeHtml(card.title),
    text: escapeHtml(card.text),
    action: escapeHtml(card.action),
    href: escapeHtml(card.href),
    icon: themeIconHtml(card.icon, "kibi-icon"),
  })

  if (card.href) {
    return html
  }

  return html
    .replace("<a ", "<div ")
    .replace("</a>", "</div>")
    .replace(/\shref=""/, "")
}

export function renderHeroShowcase(instanceId: string, settings: unknown, t: Translate) {
  const slides = readSlides(settings)
  const source =
    settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {}
  const primary = readCard(source.primary)
  const secondary = readCard(source.secondary)
  if (!slides.length && !primary && !secondary) {
    return null
  }

  const template = translateTemplate(
    readFileSync(
      path.join(process.cwd(), "src/modules/kibipage/sections/hero-showcase/index.html"),
      "utf8"
    ),
    t
  )
  const shell = template.split("<template")[0]?.trim()
  if (!shell) {
    throw new Error("Could not read the hero-showcase template.")
  }

  const slideTemplate = part(template, "slide")
  const stage = slides.length
    ? fill(part(template, "stage"), {
        slides: slides
          .map((slide, index) =>
            fill(slideTemplate, {
              active: index === 0 ? "is-active" : "",
              href: escapeHtml(slide.href),
              image: escapeHtml(slide.image),
            })
          )
          .join(""),
      })
    : ""

  const cards = [
    primary ? cardHtml(part(template, "card-accent"), primary) : "",
    secondary ? cardHtml(part(template, "card-plain"), secondary) : "",
  ].join("")
  const side = cards ? fill(part(template, "side"), { cards }) : ""

  return fill(shell, {
    instance_id: escapeHtml(instanceId),
    stage,
    side,
  })
}
