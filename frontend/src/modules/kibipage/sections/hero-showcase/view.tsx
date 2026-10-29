"use client"

import { useEffect, useRef } from "react"

import { initHeroShowcase } from "./index.js"
import "./index.css"

export default function HeroShowcaseView({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current?.querySelector("[data-kibi-section='hero-showcase']")
    if (root instanceof HTMLElement) {
      initHeroShowcase(root)
    }
  }, [html])

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}
