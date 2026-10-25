import * as OutlineIcons from "@heroicons/react/24/outline"
import type { ComponentType, SVGProps } from "react"

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

function iconName(componentName: string) {
  return componentName
    .replace(/Icon$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
}

const sectionIcons: Record<string, IconComponent> = {}

for (const [key, value] of Object.entries(OutlineIcons)) {
  if (key.endsWith("Icon")) {
    sectionIcons[iconName(key)] = value as IconComponent
  }
}

export function SectionIconMark({
  name,
  className = "h-4 w-4 shrink-0",
}: {
  name: string
  className?: string
}) {
  const Icon = sectionIcons[name]
  if (!Icon) {
    return null
  }

  return <Icon className={className} aria-hidden="true" />
}
