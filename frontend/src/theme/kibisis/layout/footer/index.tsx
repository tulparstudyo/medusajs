import { getNavigation, StoreNavItem } from "@lib/data/navigation"
import {
  getContactSettings,
  getSocialSettings,
  SocialSettings,
  telHref,
  whatsappHref,
} from "@lib/data/site-settings"

import type { Translate } from "../../i18n"
import { getKibiI18n } from "../../i18n/server"
import { ThemeIcon, ThemeIconName } from "../../icons"
import MenuLink from "../menu-link"

type ExternalLink = {
  key: keyof SocialSettings
  icon: ThemeIconName
  label: string
}

const SOCIAL_LINKS: ExternalLink[] = [
  { key: "instagram", icon: "camera", label: "Instagram" },
  { key: "youtube", icon: "play", label: "YouTube" },
  { key: "tiktok", icon: "musical-note", label: "TikTok" },
  { key: "facebook", icon: "user-group", label: "Facebook" },
  { key: "x", icon: "x-mark", label: "X (Twitter)" },
  { key: "linkedin", icon: "briefcase", label: "LinkedIn" },
]

const appLinksFor = (t: Translate): ExternalLink[] => [
  { key: "app_store", icon: "device-phone-mobile", label: t("footer.app_store") },
  { key: "google_play", icon: "play", label: t("footer.google_play") },
  { key: "app_gallery", icon: "squares-2x2", label: t("footer.app_gallery") },
]

function withUrls(links: ExternalLink[], settings: SocialSettings) {
  return links
    .map((link) => ({ ...link, href: settings[link.key].trim() }))
    .filter((link) => link.href !== "")
}

export default async function Footer() {
  const [navigation, bottom, social, contact] = await Promise.all([
    getNavigation("footer"),
    getNavigation("bottom"),
    getSocialSettings(),
    getContactSettings(),
  ])
  const { t } = await getKibiI18n()
  const bottomStart = bottom.items.filter((item) => item.align !== "end")
  const bottomEnd = bottom.items.filter((item) => item.align === "end")
  const socialLinks = withUrls(SOCIAL_LINKS, social)
  const appLinks = withUrls(appLinksFor(t), social)

  return (
    <footer className="bg-white border-t border-slate-200 mt-12 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
        {navigation.items.map((column) => (
          <FooterColumn key={column.id} item={column} />
        ))}
        {socialLinks.length > 0 && (
          <div>
            <h4 className="font-bold text-slate-900 mb-3 text-xs uppercase tracking-wider">
              {t("footer.follow_us")}
            </h4>
            <ul className="space-y-2 text-[11px]">
              {socialLinks.map((link) => (
                <li key={link.key}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-orange-600 inline-flex items-center gap-2"
                  >
                    <ThemeIcon name={link.icon} className="h-3.5 w-3.5" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {appLinks.length > 0 && (
          <div>
            <h4 className="font-bold text-slate-900 mb-3 text-xs uppercase tracking-wider">
              {t("footer.mobile_apps")}
            </h4>
            <div className="space-y-2">
              {appLinks.map((link) => (
                <a
                  key={link.key}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 text-white font-medium text-[11px] flex items-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  <ThemeIcon name={link.icon} className="h-4 w-4 shrink-0" />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
        {(contact.phone || contact.email || contact.whatsapp) && (
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <h4 className="font-bold text-slate-900 mb-3 text-xs uppercase tracking-wider">
              {t("footer.support")}
            </h4>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500">
                {t("footer.question")}
              </span>
              {contact.phone && (
                <>
                  <a
                    href={telHref(contact.phone)}
                    className="block text-lg font-black text-slate-900 mt-1 hover:text-orange-600 transition-colors"
                  >
                    {contact.phone}
                  </a>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {t("footer.hours")}
                  </span>
                </>
              )}
              {(contact.email || contact.whatsapp) && (
                <div className="mt-3 space-y-1.5 text-[11px]">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 break-all text-slate-700 hover:text-orange-600 transition-colors"
                    >
                      <ThemeIcon name="envelope" className="h-3.5 w-3.5 shrink-0" />
                      {contact.email}
                    </a>
                  )}
                  {contact.whatsapp && (
                    <a
                      href={whatsappHref(contact.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 font-semibold text-emerald-700 hover:text-emerald-600 transition-colors"
                    >
                      <ThemeIcon name="chat-bubble-left-right" className="h-3.5 w-3.5 shrink-0" />
                      {t("footer.whatsapp")}
                    </a>
                  )}
                </div>
              )}
              <button className="w-full mt-3 bg-white border border-slate-300 hover:border-orange-500 hover:text-orange-600 text-slate-800 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                {t("footer.help_center")}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="bg-slate-950 text-slate-400 py-4 px-4 border-t border-slate-900 text-[11px]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <span>
              © 2026 VipNova Elektronik Hizmetler Tic. A.Ş. {t("footer.rights")}
            </span>
            {bottomStart.map((item) => (
              <BottomLink key={item.id} item={item} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {bottomEnd.map((item) => (
              <BottomLink key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

function BottomLink({ item }: { item: StoreNavItem }) {
  return (
    <div className="relative group">
      <MenuLink item={item} className="hover:text-white transition-colors" />
      {item.children.length > 0 && (
        <div className="absolute left-0 bottom-full z-50 hidden pb-2 group-hover:block">
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

function FooterColumn({ item }: { item: StoreNavItem }) {
  return (
    <div>
      <h4 className="font-bold text-slate-900 mb-3 text-xs uppercase tracking-wider">
        {item.href ? (
          <MenuLink item={item} className="hover:text-orange-600" />
        ) : (
          item.label
        )}
      </h4>
      {item.children.length > 0 && <FooterLinks items={item.children} />}
    </div>
  )
}

function FooterLinks({ items }: { items: StoreNavItem[] }) {
  return (
    <ul className="space-y-2 text-[11px]">
      {items.map((item) => (
        <li key={item.id}>
          <MenuLink item={item} className="hover:text-orange-600" />
          {item.children.length > 0 && (
            <div className="mt-2 ml-3">
              <FooterLinks items={item.children} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
