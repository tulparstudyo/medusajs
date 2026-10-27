import { HttpTypes } from "@medusajs/types"
import { ReactNode } from "react"

import "../../kibisis.css"
import { KibiI18nProvider } from "../../i18n/client"
import { getKibiI18n } from "../../i18n/server"
import { KibisisCartProvider } from "./cart-context"
import CartDrawer from "./cart-drawer"
import Toast from "./toast"

export default async function Shell({
  children,
  cart = null,
}: {
  children: ReactNode
  cart?: HttpTypes.StoreCart | null
}) {
  const { messages, locale } = await getKibiI18n()

  return (
    <div className="kibisis font-jakarta min-h-screen bg-slate-50 text-slate-800 antialiased overflow-x-clip selection:bg-orange-500 selection:text-white">
      <KibiI18nProvider messages={messages} locale={locale}>
        <KibisisCartProvider cart={cart}>
          {children}
          <CartDrawer />
          <Toast />
        </KibisisCartProvider>
      </KibiI18nProvider>
    </div>
  )
}
