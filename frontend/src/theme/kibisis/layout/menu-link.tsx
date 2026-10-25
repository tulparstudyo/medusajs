import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { StoreNavItem } from "@lib/data/navigation"

export default function MenuLink({
  item,
  className,
}: {
  item: StoreNavItem
  className?: string
}) {
  if (!item.href || item.href.trim().toLowerCase().startsWith("javascript:")) {
    return <span className={className}>{item.label}</span>
  }

  if (item.target_type === "category") {
    return (
      <LocalizedClientLink href={item.href} className={className}>
        {item.label}
      </LocalizedClientLink>
    )
  }

  return (
    <a
      href={item.href}
      className={className}
      target={item.new_tab ? "_blank" : undefined}
      rel={item.new_tab ? "noreferrer noopener" : undefined}
    >
      {item.label}
    </a>
  )
}
