"use client"

import type { StoreNavItem } from "@lib/data/navigation"
import { MouseEvent, useEffect, useState } from "react"

import MenuLink from "../menu-link"

export default function MobileMenu({ items }: { items: StoreNavItem[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a")) {
      setOpen(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
        aria-expanded={open}
        aria-controls="mobile-main-menu"
        className="md:hidden flex items-center justify-center w-10 h-10 shrink-0 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
          />
        </svg>
      </button>
      {open && (
        <nav
          id="mobile-main-menu"
          onClick={closeOnLink}
          className="md:hidden absolute inset-x-0 top-full z-50 max-h-[70vh] overflow-y-auto border-t border-slate-100 bg-white shadow-lg"
        >
          <MobileItems items={items} depth={0} />
        </nav>
      )}
    </>
  )
}

function MobileItems({ items, depth }: { items: StoreNavItem[]; depth: number }) {
  return (
    <ul className={depth === 0 ? "divide-y divide-slate-100" : "pb-2"}>
      {items.map((item) => (
        <li key={item.id}>
          <MenuLink
            item={item}
            className={
              depth === 0
                ? "block px-4 py-3 text-sm font-semibold text-slate-800 hover:text-orange-600"
                : "block py-2 pr-4 text-[13px] text-slate-600 hover:text-orange-600"
            }
          />
          {item.children.length > 0 && (
            <div className={depth === 0 ? "pl-8" : "pl-4"}>
              <MobileItems items={item.children} depth={depth + 1} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
