import "server-only"

import { createElement, isValidElement, type ReactNode } from "react"
import * as OutlineIcons from "@heroicons/react/24/outline"
import type { ComponentType, SVGProps } from "react"

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

function iconName(componentName: string) {
  return componentName
    .replace(/Icon$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
}

const outlineIcons: Record<string, IconComponent> = {}

for (const [key, value] of Object.entries(OutlineIcons)) {
  if (key.endsWith("Icon")) {
    outlineIcons[iconName(key)] = value as IconComponent
  }
}

function attrName(name: string) {
  if (name === "className") return "class"
  if (name === "viewBox") return "viewBox"
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function escapeText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
}

function nodeToHtml(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") {
    return escapeText(String(node))
  }
  if (Array.isArray(node)) return node.map(nodeToHtml).join("")
  if (!isValidElement(node)) return ""

  const type = node.type as
    | string
    | ((props: Record<string, unknown>) => ReactNode)
    | { render?: (props: unknown, ref: null) => ReactNode }

  if (typeof type === "function") {
    return nodeToHtml(type(node.props as Record<string, unknown>))
  }

  if (typeof type === "object" && type !== null && typeof type.render === "function") {
    return nodeToHtml(type.render(node.props, null))
  }

  if (typeof type !== "string") return ""

  const props = node.props as Record<string, unknown>
  const attrs = Object.entries(props)
    .filter(
      ([key, value]) => key !== "children" && value != null && value !== false
    )
    .map(([key, value]) => `${attrName(key)}="${escapeText(String(value))}"`)
    .join(" ")

  return `<${type}${attrs ? ` ${attrs}` : ""}>${nodeToHtml(
    props.children as ReactNode
  )}</${type}>`
}

export function themeIconHtml(name: string, className: string) {
  if (!(name in outlineIcons)) return ""

  return nodeToHtml(
    createElement(outlineIcons[name], {
      className,
      "aria-hidden": true,
    })
  )
}
