"use client"

import { useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { ThemeIcon } from "../icons"
import { useKibisisCart } from "../layout/shell/cart-context"
import type { KibisisProduct } from "./data/products"

const formatPrice = (value: number) =>
  value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function ProductCard({
  product,
  layout = "rail",
}: {
  product: KibisisProduct
  layout?: "rail" | "grid"
}) {
  const { addItem, showToast } = useKibisisCart()
  const [liked, setLiked] = useState(false)

  const toggleWishlist = () => {
    if (liked) {
      setLiked(false)
      showToast("Favorilerden kaldırıldı", "heart")
    } else {
      setLiked(true)
      showToast("Favorilere eklendi!", "heart")
    }
  }

  const detailHref = product.handle ? `/products/${product.handle}` : ""

  return (
    <div
      className={`product-card relative bg-white border border-slate-200 p-3 flex flex-col justify-between hover:shadow-md hover:border-orange-200 transition-all group ${
        layout === "grid"
          ? "w-full min-w-0 rounded-2xl"
          : "min-w-[220px] max-w-[220px] rounded-xl"
      }`}
    >
      {detailHref ? (
        <LocalizedClientLink
          href={detailHref}
          aria-label={product.title}
          className="absolute inset-0 z-0 rounded-xl"
        />
      ) : null}
      <div className="relative z-10 pointer-events-none">
        <div
          className={`relative w-full bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center ${
            layout === "grid" ? "aspect-[2/3]" : ""
          }`}
        >
          <span
            className={`absolute top-2 left-2 ${product.badgeClass} text-white text-[9px] font-bold px-1.5 py-0.5 rounded`}
          >
            {product.badge}
          </span>
          <button
            className={`wishlist-btn pointer-events-auto absolute top-2 right-2 ${
              liked ? "text-red-500" : "text-slate-400"
            } hover:text-red-500 transition-colors`}
            onClick={toggleWishlist}
          >
            <svg
              className="w-4 h-4"
              fill={liked ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              ></path>
            </svg>
          </button>
          {product.image ? (
            // Plain <img> keeps the original markup/layout; images are remote placeholders.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.imageAlt}
              className={
                layout === "grid"
                  ? "h-full w-full object-contain group-hover:scale-105 transition-transform"
                  : "object-contain group-hover:scale-105 transition-transform"
              }
            />
          ) : null}
        </div>
        <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 mt-2 leading-relaxed">
          {product.title}
        </h3>
        {product.rating !== "—" ? (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-500 mt-1">
            <ThemeIcon name="star" className="h-3.5 w-3.5" />
            <span>{product.rating}</span>
            {product.reviews ? (
              <span className="text-slate-400 font-normal">
                ({product.reviews})
              </span>
            ) : null}
          </div>
        ) : null}
        {product.note ? (
          <div className={`text-[10px] ${product.noteClass} font-bold mt-1`}>
            {product.note}
          </div>
        ) : null}
      </div>
      <div className="relative z-10 pointer-events-none pt-3 border-t border-slate-100 mt-2 flex items-center justify-between">
        <div>
          {product.oldPrice !== undefined && (
            <span className="text-[10px] text-slate-400 line-through">
              {formatPrice(product.oldPrice)} TL
            </span>
          )}
          <div className="text-sm font-extrabold text-slate-950">
            {formatPrice(product.price)} <span className="text-[11px]">TL</span>
          </div>
        </div>
        <button
          className="add-to-cart-btn pointer-events-auto p-2 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white transition-colors"
          title="Sepete Ekle"
          onClick={() =>
            addItem({
              variantId: product.variantId,
              name: product.name,
              price: product.price,
            })
          }
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
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            ></path>
          </svg>
        </button>
      </div>
    </div>
  )
}
