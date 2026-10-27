import { getNavigation, StoreNavItem } from "@lib/data/navigation"
import {
  getContactSettings,
  storeInitials,
  storeName,
} from "@lib/data/site-settings"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { getKibiI18n } from "../../i18n/server"
import MenuLink from "../menu-link"
import CartTrigger from "./cart-trigger"
import MobileMenu from "./mobile-menu"
import { ScrollHeader } from "./scroll-chrome"
import SearchBox from "./search-box"
import TopBar from "./top-bar"

export default async function Nav() {
  const [navigation, contact] = await Promise.all([
    getNavigation("main"),
    getContactSettings(),
  ])
  const { t } = await getKibiI18n()
  const items = navigation.items
  const name = storeName(contact)
  const words = name.split(/\s+/).filter(Boolean)
  const accent = words.length > 1 ? words.pop() : null

  return (
    <>
      <TopBar />
      <ScrollHeader>
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4 lg:gap-8">
            {items.length > 0 && <MobileMenu items={items} />}
            <LocalizedClientLink
              href="/"
              aria-label={name}
              className="flex items-center gap-2 shrink-0"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-orange-500/20">
                {storeInitials(name)}
              </div>
              <div className="hidden md:flex flex-col leading-none">
                <span className="text-2xl font-extrabold tracking-tight text-slate-950">
                  {words.join(" ")}
                  {accent && <span className="text-orange-600"> {accent}</span>}
                </span>
                <span className="text-[9px] font-semibold text-slate-400 tracking-wider uppercase">
                  {t("nav.marketplace")}
                </span>
              </div>
            </LocalizedClientLink>
            <SearchBox />
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <LocalizedClientLink
                href="/account"
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors text-xs"
              >
                <svg
                  className="w-4 h-4 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  ></path>
                </svg>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {t("nav.sign_in")}
                  </span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {t("nav.or_sign_up")}
                  </span>
                </div>
              </LocalizedClientLink>
              <CartTrigger />
            </div>
          </div>
        </div>
        {items.length > 0 && (
          <nav className="hidden md:block bg-white border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-semibold text-slate-700 py-2.5">
              {items.map((item) => (
                <NavEntry key={item.id} item={item} />
              ))}
            </div>
          </nav>
        )}
      </ScrollHeader>
    </>
  )
}

const linkClass =
  "hover:text-orange-600 transition-colors py-1 border-b-2 border-transparent hover:border-orange-600"

function NavEntry({ item }: { item: StoreNavItem }) {
  return (
    <div className="relative group">
      <MenuLink item={item} className={linkClass} />
      {item.children.length > 0 && (
        <div className="absolute left-0 top-full z-50 hidden pt-2 group-hover:block">
          <div className="min-w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <NavChildren items={item.children} />
          </div>
        </div>
      )}
    </div>
  )
}

function NavChildren({ items }: { items: StoreNavItem[] }) {
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <div key={item.id} className="px-2 py-1.5">
          <MenuLink item={item} className="hover:text-orange-600" />
          {item.children.length > 0 && (
            <div className="mt-1 ml-3">
              <NavChildren items={item.children} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
