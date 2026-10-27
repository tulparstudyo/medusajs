"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MouseEvent, useCallback, useEffect, useRef, useState } from "react"

import {
  COLLECTION_QUERY_KEY,
  OPTION_VALUE_QUERY_KEY,
  SEARCH_QUERY_KEY,
  SORT_QUERY_KEY,
} from "@lib/util/listing-params"

import type { KibisisProduct } from "../home/data/products"
import ProductCard from "../home/product-card"
import { useT } from "../i18n/client"
import { loadListingPage, type ListingRequest } from "./load-page"

const AUTO_LOAD_LIMIT = 4
const PRELOAD_MARGIN = 600
// Sticky top bar plus the header that slides back in while scrolling up.
const SCROLL_OFFSET = 160

type Chunk = { page: number; cards: KibisisProduct[] }

function pageHref(pathname: string, request: ListingRequest, page: number) {
  const params = new URLSearchParams()
  if (request.q) {
    params.set(SEARCH_QUERY_KEY, request.q)
  }
  if (request.sortBy && request.sortBy !== "created_at") {
    params.set(SORT_QUERY_KEY, request.sortBy)
  }
  request.collectionIds.forEach((id) => params.append(COLLECTION_QUERY_KEY, id))
  request.optionValueIds.forEach((id) =>
    params.append(OPTION_VALUE_QUERY_KEY, id)
  )
  if (page > 1) {
    params.set("page", String(page))
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function writePageToUrl(page: number) {
  const url = new URL(window.location.href)
  if (page > 1) {
    url.searchParams.set("page", String(page))
  } else {
    url.searchParams.delete("page")
  }
  if (url.href !== window.location.href) {
    window.history.replaceState(null, "", url.href)
  }
}

function scrollToElement(element: Element | null) {
  if (!element) {
    return
  }
  const top =
    element.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET
  window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" })
}

function paginationItems(current: number, total: number) {
  const pages = new Set([1, total])
  for (let page = current - 2; page <= current + 2; page++) {
    if (page >= 1 && page <= total) {
      pages.add(page)
    }
  }

  const sorted = Array.from(pages).sort((a, b) => a - b)
  const items: (number | "gap")[] = []
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1]
    if (index > 0 && page - previous === 2) {
      items.push(previous + 1)
    } else if (index > 0 && page - previous > 2) {
      items.push("gap")
    }
    items.push(page)
  })
  return items
}

export default function InfiniteProductGrid({
  request,
  initialPage,
  initialCards,
  totalPages,
}: {
  request: ListingRequest
  initialPage: number
  initialCards: KibisisProduct[]
  totalPages: number
}) {
  const t = useT()
  const pathname = usePathname()
  const [chunks, setChunks] = useState<Chunk[]>([
    { page: initialPage, cards: initialCards },
  ])
  const [syncedCards, setSyncedCards] = useState(initialCards)
  const [autoLoads, setAutoLoads] = useState(0)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loading = useRef(false)
  const scrollOnReset = useRef(false)

  // A server re-render (router.refresh, back/forward, pagination link) hands
  // over a new starting page. Pages already on screen are kept; anything else
  // restarts the scroll chain from the requested page.
  if (syncedCards !== initialCards) {
    setSyncedCards(initialCards)
    if (chunks.some((chunk) => chunk.page === initialPage)) {
      setChunks(
        chunks.map((chunk) =>
          chunk.page === initialPage
            ? { page: initialPage, cards: initialCards }
            : chunk
        )
      )
    } else {
      setChunks([{ page: initialPage, cards: initialCards }])
      setAutoLoads(0)
      setStatus("idle")
    }
  }

  const firstPage = chunks[0].page
  const lastPage = chunks[chunks.length - 1].page
  const hasMore = lastPage < totalPages
  const autoDone = autoLoads >= AUTO_LOAD_LIMIT
  const isEmpty = chunks.every((chunk) => chunk.cards.length === 0)
  const showPagination =
    totalPages > 1 && ((hasMore && autoDone) || (!hasMore && firstPage > 1))

  const loadNext = useCallback(async () => {
    if (loading.current) {
      return
    }
    loading.current = true
    const page = lastPage + 1
    setStatus("loading")

    try {
      const result = await loadListingPage(request, page)
      setChunks((current) =>
        current[current.length - 1].page === page - 1
          ? [...current, { page, cards: result.cards }]
          : current
      )
      setAutoLoads((count) => count + 1)
      setStatus("idle")
    } catch {
      setStatus("error")
    } finally {
      loading.current = false
    }
  }, [lastPage, request])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || autoDone || status !== "idle") {
      return
    }

    // Position check instead of an IntersectionObserver: a jump to the page
    // bottom (End key, scrollbar drag) skips past the sentinel without ever
    // intersecting it.
    let frame = 0
    const check = () => {
      frame = 0
      if (
        sentinel.getBoundingClientRect().top <
        window.innerHeight + PRELOAD_MARGIN
      ) {
        loadNext()
      }
    }
    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(check)
      }
    }

    // Restored scroll positions (reload, back navigation) never emit a scroll
    // event, so check once when the user is already past the top.
    if (window.scrollY > 0) {
      onScroll()
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [autoDone, hasMore, loadNext, status])

  useEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting)
        const page = Number(
          (visible?.target as HTMLElement | undefined)?.dataset.page
        )
        if (page) {
          writePageToUrl(page)
        }
      },
      { rootMargin: "-40% 0px -60% 0px" }
    )
    list
      .querySelectorAll("[data-page]")
      .forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [chunks])

  useEffect(() => {
    if (scrollOnReset.current) {
      scrollOnReset.current = false
      scrollToElement(listRef.current)
    }
  }, [firstPage])

  const onPageClick = (event: MouseEvent<HTMLAnchorElement>, page: number) => {
    const loaded = listRef.current?.querySelector(`[data-page="${page}"]`)
    if (loaded) {
      event.preventDefault()
      writePageToUrl(page)
      scrollToElement(loaded)
      return
    }
    scrollOnReset.current = true
  }

  const pageLink = (
    page: number,
    label: string,
    className: string,
    rel?: string
  ) => (
    <Link
      key={`${label}-${page}`}
      href={pageHref(pathname, request, page)}
      scroll={false}
      rel={rel}
      aria-current={page === lastPage ? "page" : undefined}
      onClick={(event) => onPageClick(event, page)}
      className={className}
    >
      {label}
    </Link>
  )

  return (
    <div className="space-y-4">
      <div ref={listRef} className="space-y-4" data-testid="products-list">
        {isEmpty ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            {t("listing.no_results")}
          </div>
        ) : (
          chunks.map((chunk, index) => (
            <section
              key={chunk.page}
              data-page={chunk.page}
              className="space-y-3"
            >
              {index > 0 ? (
                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
                  <span className="h-px flex-1 bg-slate-200"></span>
                  {t("listing.page", { page: chunk.page })}
                  <span className="h-px flex-1 bg-slate-200"></span>
                </div>
              ) : null}
              <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {chunk.cards.map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} layout="grid" />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div ref={sentinelRef} aria-hidden="true" className="h-px"></div>

      {status === "loading" ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-slate-500"
        >
          <span className="h-4 w-4 rounded-full border-2 border-orange-200 border-t-orange-600 animate-spin"></span>
          {t("listing.loading")}
        </div>
      ) : null}

      {status === "error" ? (
        <div className="flex flex-col items-center gap-2 py-4 text-xs text-slate-500">
          <span>{t("listing.load_error")}</span>
          <button
            type="button"
            onClick={loadNext}
            className="rounded-xl bg-orange-600 px-4 py-2 font-bold text-white hover:bg-orange-700 transition-colors"
          >
            {t("listing.retry")}
          </button>
        </div>
      ) : null}

      {showPagination ? (
        <nav
          aria-label={t("listing.pages")}
          className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
          data-testid="product-pagination"
        >
          {firstPage > 1
            ? pageLink(
                firstPage - 1,
                `‹ ${t("listing.previous")}`,
                "h-9 rounded-xl border border-slate-200 bg-white px-3 inline-flex items-center text-xs font-bold text-slate-700 hover:border-orange-300 hover:text-orange-600 transition-colors",
                "prev"
              )
            : null}
          {paginationItems(lastPage, totalPages).map((item, index) =>
            item === "gap" ? (
              <span
                key={`gap-${index}`}
                className="px-1 text-xs font-bold text-slate-400"
              >
                …
              </span>
            ) : (
              pageLink(
                item,
                String(item),
                `h-9 min-w-9 rounded-xl border px-2 inline-flex items-center justify-center text-xs font-bold transition-colors ${
                  item === lastPage
                    ? "border-orange-600 bg-orange-600 text-white"
                    : item >= firstPage && item <= lastPage
                    ? "border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-400"
                    : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-600"
                }`
              )
            )
          )}
          {hasMore
            ? pageLink(
                lastPage + 1,
                `${t("listing.next")} ›`,
                "h-9 rounded-xl bg-orange-600 px-4 inline-flex items-center text-xs font-bold text-white hover:bg-orange-700 transition-colors",
                "next"
              )
            : null}
        </nav>
      ) : null}
    </div>
  )
}
