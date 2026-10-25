"use client"

import { useEffect, useRef, useState } from "react"

import { ThemeIcon } from "../../icons"

export default function SearchBox() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("click", onDocumentClick)
    return () => document.removeEventListener("click", onDocumentClick)
  }, [])

  return (
    <div ref={containerRef} className="flex-1 max-w-2xl relative">
      <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:bg-white transition-all overflow-hidden">
        <span className="pl-3.5 pr-2 text-slate-400">
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
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </span>
        <input
          type="text"
          id="search-input"
          onFocus={() => setOpen(true)}
          placeholder="Ürün, kategori veya marka ara..."
          className="w-full py-2.5 px-2 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          id="search-btn"
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-4 py-2.5 transition-colors shrink-0"
        >
          ARA
        </button>
      </div>
      <div
        id="search-results"
        className={`${
          open ? "" : "hidden "
        }absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs`}
      >
        <div className="text-[11px] font-semibold text-slate-400 px-3 py-1.5">
          Popüler Aramalar
        </div>
        {(
          [
            ["speaker-wave", "Apple AirPods Pro"],
            ["fire", "Philips Airfryer XXL"],
            ["bolt", "Akü Takviye Cihazı"],
          ] as const
        ).map(([icon, label]) => (
          <a
            key={label}
            href="#popular-products"
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            <ThemeIcon name={icon} className="h-4 w-4 text-slate-400" />
            {label}
          </a>
        ))}
      </div>
    </div>
  )
}
