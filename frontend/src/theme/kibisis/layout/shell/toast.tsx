"use client"

import { ThemeIcon } from "../../icons"
import { useKibisisCart } from "./cart-context"

export default function Toast() {
  const { toast } = useKibisisCart()

  return (
    <div
      id="toast"
      className={`fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl transform ${
        toast.visible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
      } transition-all pointer-events-none flex items-center gap-2`}
    >
      <ThemeIcon name={toast.icon} className="h-4 w-4" />
      <span id="toast-message">{toast.message}</span>
    </div>
  )
}
