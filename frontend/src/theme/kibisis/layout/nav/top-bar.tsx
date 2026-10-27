import { getLocale } from "@lib/data/locale-actions"
import { listLocales } from "@lib/data/locales"
import { getNavigation, StoreNavItem } from "@lib/data/navigation"
import { listRegions } from "@lib/data/regions"
import { DEFAULT_LOCALE } from "@lib/util/default-locale"
import { getContactSettings, storeName, telHref } from "@lib/data/site-settings"

import MenuLink from "../menu-link"
import CurrencySwitch, { CurrencyRegion } from "./currency-switch"
import LanguageSwitch from "./language-switch"
import { StickyTopBar } from "./scroll-chrome"

const linkClass = "hover:text-white transition-colors"

export default async function TopBar() {
  const [navigation, contact, locales, currentLocale, regions] =
    await Promise.all([
      getNavigation("top"),
      getContactSettings(),
      listLocales(),
      getLocale(),
      listRegions().catch(() => null),
    ])
  const hasLanguages = !!locales && locales.length > 1
  const currencyRegions: CurrencyRegion[] = (regions ?? [])
    .filter((region) => !!region.currency_code)
    .map((region) => ({
      currency: region.currency_code.toLowerCase(),
      countries: (region.countries ?? [])
        .map((country) => country.iso_2?.toLowerCase() ?? "")
        .filter(Boolean),
    }))
  const hasCurrencies = currencyRegions.length > 0
  if (
    navigation.items.length === 0 &&
    !contact.phone &&
    !hasLanguages &&
    !hasCurrencies
  ) {
    return null
  }

  const startItems = navigation.items.filter((item) => item.align !== "end")
  const endItems = navigation.items.filter((item) => item.align === "end")

  return (
    <StickyTopBar>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>{" "}
            {storeName(contact)} Premium
          </span>
          {startItems.length > 0 && <span className="hidden sm:inline">|</span>}
          {startItems.map((item) => (
            <TopLink key={item.id} item={item} />
          ))}
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          {endItems.map((item) => (
            <TopLink key={item.id} item={item} />
          ))}
          {contact.phone && (
            <a
              href={telHref(contact.phone)}
              className="font-bold text-amber-300 hover:text-amber-200 transition-colors"
            >
              {contact.phone}
            </a>
          )}
          {hasLanguages && (
            <LanguageSwitch
              locales={locales}
              current={currentLocale}
              fallback={DEFAULT_LOCALE}
            />
          )}
          {hasCurrencies && (
            <CurrencySwitch
              regions={currencyRegions}
              locale={currentLocale ?? DEFAULT_LOCALE}
            />
          )}
        </div>
      </div>
    </StickyTopBar>
  )
}

function TopLink({ item }: { item: StoreNavItem }) {
  return (
    <div className="relative group">
      <MenuLink item={item} className={linkClass} />
      {item.children.length > 0 && (
        <div className="absolute left-0 top-full z-50 hidden pt-2 group-hover:block">
          <div className="min-w-44 rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-lg">
            {item.children.map((child) => (
              <div key={child.id} className="px-2 py-1.5">
                <MenuLink item={child} className="hover:text-orange-600" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
