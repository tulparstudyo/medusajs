"use client"

import { useRef } from "react"

import type { KibisisProduct } from "./data/products"
import ProductCard from "./product-card"
import { ThemeIcon } from "../icons"

type ProductRailProps = {
  sectionId: string
  title: string
  products: KibisisProduct[]
  controls: "scroll" | "link"
}

export default function ProductRail({
  sectionId,
  title,
  products,
  controls,
}: ProductRailProps) {
  const railRef = useRef<HTMLDivElement>(null)

  const scrollBy = (left: number) => {
    railRef.current?.scrollBy({ left, behavior: "smooth" })
  }

  return (
    <section
      id={sectionId}
      className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-6 bg-orange-600 rounded-full"></span>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
            {title}
          </h2>
        </div>
        {controls === "scroll" ? (
          <div className="flex items-center gap-2">
            <button
              className="scroll-prev-btn p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              onClick={() => scrollBy(-300)}
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
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
            </button>
            <button
              className="scroll-next-btn p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              onClick={() => scrollBy(300)}
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
                  d="M9 5l7 7-7 7"
                ></path>
              </svg>
            </button>
          </div>
        ) : (
          <a
            href={`#${sectionId}`}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            Tümünü Gör <ThemeIcon name="chevron-right" className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div
        ref={railRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2"
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
