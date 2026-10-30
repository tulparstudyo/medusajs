"use client"

import React from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import AccountNav from "@modules/account/components/account-nav"
import { HttpTypes } from "@medusajs/types"
import { useT } from "../i18n/client"
import { ThemeIcon } from "../icons"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}

export default function KibisisAccountLayout({
  customer,
  children,
}: AccountLayoutProps) {
  const t = useT()

  return (
    <div className="flex-1 py-6 sm:py-10" data-testid="account-page">
      <div className="max-w-7xl mx-auto px-4 flex flex-col gap-8">
        <div
          className={
            customer
              ? "grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start"
              : "max-w-xl mx-auto w-full"
          }
        >
          {customer && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <AccountNav customer={customer} />
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            {children}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
              <ThemeIcon name="chat-bubble-left-right" className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t("account.got_questions")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("account.questions_hint")}
              </p>
            </div>
          </div>
          <LocalizedClientLink
            href="/customer-service"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-300 hover:border-orange-500 hover:text-orange-600 text-slate-800 text-xs font-semibold transition-colors shrink-0"
          >
            {t("account.customer_service")}
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}

