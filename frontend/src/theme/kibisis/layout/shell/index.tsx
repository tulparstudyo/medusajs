import { HttpTypes } from "@medusajs/types"
import { ReactNode } from "react"

import "../../kibisis.css"
import { KibisisCartProvider } from "./cart-context"
import CartDrawer from "./cart-drawer"
import Toast from "./toast"

export default function Shell({
  children,
  cart = null,
}: {
  children: ReactNode
  cart?: HttpTypes.StoreCart | null
}) {
  return (
    <div className="kibisis font-jakarta min-h-screen bg-slate-50 text-slate-800 antialiased overflow-x-clip selection:bg-orange-500 selection:text-white">
      <KibisisCartProvider cart={cart}>
        {children}
        <CartDrawer />
        <Toast />
      </KibisisCartProvider>
    </div>
  )
}
