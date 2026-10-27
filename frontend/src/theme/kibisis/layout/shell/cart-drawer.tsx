"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { useMoney, useT } from "../../i18n/client"
import { ThemeIcon } from "../../icons"
import { useKibisisCart } from "./cart-context"

export default function CartDrawer() {
  const { items, count, total, currency, checkoutPath, drawerOpen, closeCart, removeItem } =
    useKibisisCart()
  const t = useT()
  const money = useMoney()

  return (
    <div
      id="cart-drawer"
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        id="cart-backdrop"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
        onClick={closeCart}
      ></div>
      <div
        className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col transform ${
          drawerOpen ? "" : "translate-x-full"
        } transition-transform duration-300 pointer-events-auto`}
        id="cart-panel"
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThemeIcon name="shopping-cart" className="h-5 w-5 text-orange-600" />
            <h3 className="font-bold text-slate-900 text-base">
              {t("drawer.title")} (<span id="cart-drawer-count">{count}</span>)
            </h3>
          </div>
          <button
            id="close-cart-btn"
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            onClick={closeCart}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        <div
          id="cart-items-container"
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400">
              <ThemeIcon name="shopping-bag" className="mb-2 h-10 w-10" />
              <p className="text-sm font-semibold text-slate-600">
                {t("cart.empty")}
              </p>
              <p className="text-xs mt-1">
                {t("drawer.empty_hint")}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div className="flex-1">
                  <h4 className="text-xs font-semibold text-slate-800 line-clamp-1">
                    {item.name}
                  </h4>
                  <div className="text-xs font-bold text-orange-600 mt-0.5">
                    {money(item.price, currency)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    x{item.quantity}
                  </span>
                  <button
                    className="remove-cart-item text-slate-400 hover:text-red-500 p-1"
                    onClick={() => removeItem(item.id)}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{t("drawer.subtotal")}</span>
            <span
              id="cart-subtotal"
              className="font-extrabold text-slate-900 text-base"
            >
              {money(total, currency)}
            </span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <ThemeIcon name="check" className="h-3.5 w-3.5" /> {t("drawer.free_shipping")}
          </div>
          <LocalizedClientLink
            href={count > 0 ? checkoutPath : "/cart"}
            onClick={closeCart}
            className="flex w-full items-center justify-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-orange-600/20 text-sm"
          >
            {t("drawer.complete")}
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}
