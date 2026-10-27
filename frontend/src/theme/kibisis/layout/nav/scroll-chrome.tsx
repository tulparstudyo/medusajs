"use client"

import { ReactNode, useEffect, useRef, useState } from "react"

const TOPBAR_HEIGHT_VAR = "--kibisis-topbar-h"
const SCROLL_DELTA = 6

export function StickyTopBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const element = ref.current
    const wrapper = element?.closest<HTMLElement>(".kibisis")
    if (!element || !wrapper) {
      return
    }

    const updateHeight = () => {
      wrapper.style.setProperty(TOPBAR_HEIGHT_VAR, `${element.offsetHeight}px`)
    }
    const updateStuck = () => setStuck(window.scrollY > 0)

    updateHeight()
    updateStuck()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    window.addEventListener("scroll", updateStuck, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", updateStuck)
      wrapper.style.removeProperty(TOPBAR_HEIGHT_VAR)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`sticky top-0 z-50 bg-gradient-to-r text-slate-300 text-xs py-2 px-4 border-b border-slate-700/50 transition-colors duration-300 ${
        stuck
          ? "from-slate-900/75 via-slate-800/75 to-slate-900/75 backdrop-blur-md backdrop-saturate-150"
          : "from-slate-900 via-slate-800 to-slate-900"
      }`}
    >
      {children}
    </div>
  )
}

export function ScrollHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const [hidden, setHidden] = useState(false)
  const [floating, setFloating] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0

    const update = () => {
      frame = 0
      const header = ref.current
      const y = window.scrollY
      const delta = y - lastY
      const headerHeight = header?.offsetHeight ?? 0
      // Keep the header open while the user is interacting with it
      // (search input focused, mobile menu expanded).
      const busy =
        !!header &&
        (header.contains(document.activeElement) ||
          !!header.querySelector('[aria-expanded="true"]'))

      setFloating(y > headerHeight)

      if (y <= headerHeight) {
        setHidden(false)
        lastY = y
      } else if (delta > SCROLL_DELTA) {
        setHidden(!busy)
        lastY = y
      } else if (delta < -SCROLL_DELTA) {
        setHidden(false)
        lastY = y
      }
    }

    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // No transform class while visible: a transform would turn the header into
  // the containing block of fixed-position descendants.
  return (
    <header
      ref={ref}
      onFocusCapture={() => setHidden(false)}
      style={{ top: `var(${TOPBAR_HEIGHT_VAR}, 0px)` }}
      className={`bg-white border-b border-slate-200 sticky z-40 transition-[transform,opacity,box-shadow] duration-300 ease-out motion-reduce:transition-none ${
        hidden
          ? "-translate-y-full opacity-0 pointer-events-none"
          : "opacity-100"
      } ${floating && !hidden ? "shadow-md" : "shadow-xs"}`}
    >
      {children}
    </header>
  )
}
