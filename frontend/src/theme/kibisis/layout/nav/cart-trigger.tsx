"use client"

import { useKibisisCart } from "../shell/cart-context"

export default function CartTrigger() {
  const { count, openCart } = useKibisisCart()

  return (
    <button
      id="open-cart-btn"
      onClick={openCart}
      className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl transition-all shadow-sm"
    >
      <div className="relative">
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
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          ></path>
        </svg>
        <span
          id="cart-counter"
          className="absolute -top-2 -right-2 bg-orange-600 text-white font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center"
        >
          {count}
        </span>
      </div>
      <span className="hidden md:inline font-bold text-xs">Sepetim</span>
    </button>
  )
}
