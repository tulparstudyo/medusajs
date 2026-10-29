"use client"

import { useEffect, useRef } from "react"

import { initPromoBanner } from "./index.js"
import "./index.css"

export default function PromoBannerView({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current?.querySelector("[data-kibi-section='promo-banner']")
    if (root instanceof HTMLElement) {
      initPromoBanner(root)
    }
  }, [html])

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}
