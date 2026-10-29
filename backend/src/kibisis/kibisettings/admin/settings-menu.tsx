import {
  BuildingStorefront,
  ChevronRight,
  CreditCard,
  Envelope,
  Language,
  Share,
  TruckFast,
} from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

import { SETTINGS_MENU, SettingsKey } from "../types"

const MENU_ICONS: Record<SettingsKey, typeof Envelope> = {
  store: BuildingStorefront,
  social: Share,
  payment: CreditCard,
  carriers: TruckFast,
  smtp: Envelope,
  translate: Language,
}

export const settingsPath = (key: SettingsKey) => `/kibisettings/${key}`

export function SettingsMenuList() {
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">Site Ayarları</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Düzenlemek istediğiniz ayar grubunu seçin.
        </Text>
      </div>
      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Text size="xsmall" weight="plus" className="uppercase text-ui-fg-muted">
          Ayarlar
        </Text>
        {SETTINGS_MENU.map((item) => {
          const Icon = MENU_ICONS[item.key]
          return (
            <Link
              key={item.key}
              to={settingsPath(item.key)}
              className="flex items-center gap-x-4 rounded-lg border border-ui-border-base px-4 py-3 transition-colors hover:bg-ui-bg-base-hover"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle">
                <Icon aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <Text weight="plus">{item.label}</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {item.description}
                </Text>
              </span>
              <ChevronRight className="shrink-0 text-ui-fg-muted" aria-hidden="true" />
            </Link>
          )
        })}
      </div>
    </Container>
  )
}
