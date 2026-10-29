"use client"

import { useEffect, useRef } from "react"

import { initQuickCategories } from "./index.js"
import "./index.css"

export default function QuickCategoriesView({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current?.querySelector("[data-kibi-section='quick-categories']")
    if (root instanceof HTMLElement) {
      initQuickCategories(root)
    }
  }, [html])

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}
