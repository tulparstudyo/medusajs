"use client"

import { useParams } from "next/navigation"
import { useTransition } from "react"
import { signout } from "@lib/data/customer"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useT } from "../../i18n/client"

export default function AccountButton({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) {
  const t = useT()
  const { countryCode } = useParams() as { countryCode?: string }
  const [pending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(async () => {
      await signout(countryCode || "tr")
    })
  }

  if (!customer) {
    return (
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
          />
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
    )
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <LocalizedClientLink
        href="/account"
        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors text-xs"
        title={t("account.title")}
      >
        <svg
          className="w-4 h-4 text-orange-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <div className="hidden sm:flex flex-col text-left max-w-[100px]">
          <span className="text-[10px] text-slate-400 font-medium truncate">
            {customer.first_name || t("account.title")}
          </span>
          <span className="font-bold text-slate-800 text-[11px]">
            {t("account.title")}
          </span>
        </div>
      </LocalizedClientLink>

      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 transition-colors text-xs disabled:opacity-50 cursor-pointer group"
        title={t("account.logout")}
        data-testid="header-logout-button"
      >
        <svg
          className="w-4 h-4 text-slate-500 group-hover:text-rose-600 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        <span className="hidden sm:inline font-bold text-slate-700 group-hover:text-rose-600 text-[11px] transition-colors">
          {t("account.logout")}
        </span>
      </button>
    </div>
  )
}

