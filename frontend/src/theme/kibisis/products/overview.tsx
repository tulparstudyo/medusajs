"use client"

import type { ProductColor } from "@lib/data/product-colors"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PointerEvent, ReactNode, TouchEvent, useEffect, useMemo, useRef, useState } from "react"

import type { Translate } from "../i18n"
import { useMoney, useT } from "../i18n/client"
import { ThemeIcon } from "../icons"
import { useKibisisCart } from "../layout/shell/cart-context"

const ImageLightbox = dynamic(() => import("./image-lightbox"), { ssr: false })

const FREE_SHIPPING_FROM = 150
const PREMIUM_RATE = 0.03
const HOVER_ZOOM = 2.5

type Price = {
  price: number
  original: number
  currency?: string
}

const POPULAR_TAGS = new Set(["bestseller", "popüler", "populer", "popular"])
const ADVANTAGE_TAGS = new Set(["avantajlı", "avantajli", "advantageous"])

function metaText(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key]
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  return null
}

function optionsAsKeymap(variantOptions: HttpTypes.StoreProductVariant["options"]) {
  const map: Record<string, string> = {}
  for (const option of variantOptions ?? []) {
    if (option.option_id && option.value) {
      map[option.option_id] = option.value
    }
  }

  return map
}

function variantPrice(variant: HttpTypes.StoreProductVariant | undefined): Price | null {
  const calculated = variant?.calculated_price
  const amount = calculated?.calculated_amount
  if (!calculated || typeof amount !== "number") {
    return null
  }

  const original =
    typeof calculated.original_amount === "number" ? calculated.original_amount : amount

  return {
    price: amount,
    original,
    currency: calculated.currency_code || undefined,
  }
}

function cheapest(variants: HttpTypes.StoreProductVariant[]) {
  let best: Price | null = null
  for (const variant of variants) {
    const price = variantPrice(variant)
    if (!price) {
      continue
    }

    if (!best || price.price < best.price) {
      best = price
    }
  }

  return best
}

function inStock(variant: HttpTypes.StoreProductVariant | undefined) {
  if (!variant) {
    return false
  }

  if (!variant.manage_inventory || variant.allow_backorder) {
    return true
  }

  return (variant.inventory_quantity || 0) > 0
}

function isSwatch(title: string) {
  const name = title.trim().toLocaleLowerCase("tr-TR")
  return name === "renk" || name === "color" || name === "colour"
}

function optionValues(product: HttpTypes.StoreProduct, option: HttpTypes.StoreProductOption) {
  const listed = (option.values ?? [])
    .map((value) => value.value)
    .filter((value): value is string => Boolean(value))
  if (listed.length) {
    return listed
  }

  const found = new Set<string>()
  for (const variant of product.variants ?? []) {
    for (const item of variant.options ?? []) {
      if (item.option_id === option.id && item.value) {
        found.add(item.value)
      }
    }
  }

  return Array.from(found)
}

function matchesPartial(
  variant: HttpTypes.StoreProductVariant,
  options: Record<string, string>
) {
  const map = optionsAsKeymap(variant.options)
  return Object.entries(options).every(([id, value]) => map[id] === value)
}

function imageUrl(
  product: HttpTypes.StoreProduct,
  image: { id: string; url: string }
) {
  return product.images?.find((item) => item.id === image.id)?.url || image.url
}

function imagesNamed(product: HttpTypes.StoreProduct, label: string) {
  const needle = label.trim().toLocaleLowerCase("en-US")
  if (needle.length < 3) {
    return []
  }

  return (product.images ?? []).filter((image) =>
    image.url.toLocaleLowerCase("en-US").includes(needle)
  )
}

function sharesEveryImage(
  product: HttpTypes.StoreProduct,
  variant: HttpTypes.StoreProductVariant | undefined
) {
  const variantImages = variant?.images ?? []
  const productImages = product.images ?? []
  if (!variantImages.length || variantImages.length !== productImages.length) {
    return false
  }

  return variantImages.every((image) =>
    productImages.some((item) => item.id === image.id)
  )
}

function imageForValue(
  product: HttpTypes.StoreProduct,
  optionId: string,
  value: string
) {
  const named = imagesNamed(product, value)
  if (named[0]?.url) {
    return named[0].url
  }

  for (const variant of product.variants ?? []) {
    if (optionsAsKeymap(variant.options)[optionId] !== value) {
      continue
    }

    const image = variant.images?.[0]
    if (image?.url) {
      return imageUrl(product, image)
    }
  }

  return undefined
}

function galleryOf(
  product: HttpTypes.StoreProduct,
  variant: HttpTypes.StoreProductVariant | undefined
) {
  const source = variant?.images?.length ? variant.images : (product.images ?? [])
  const images = source
    .map((image) => {
      const url = imageUrl(product, image)
      return url ? { id: image.id, url } : null
    })
    .filter((image): image is { id: string; url: string } => Boolean(image))

  if (images.length) {
    return images
  }

  if (product.thumbnail) {
    return [{ id: "thumbnail", url: product.thumbnail }]
  }

  return []
}

function saleBadge(product: HttpTypes.StoreProduct, onSale: boolean, t: Translate) {
  if (onSale) {
    return { label: t("badge.sale"), className: "bg-rose-500" }
  }

  const tags = (product.tags ?? []).map((tag) =>
    (tag.value ?? "").trim().toLocaleLowerCase("tr-TR")
  )
  if (tags.some((tag) => ADVANTAGE_TAGS.has(tag))) {
    return { label: t("badge.deal"), className: "bg-orange-600" }
  }

  if (tags.some((tag) => POPULAR_TAGS.has(tag))) {
    return { label: t("badge.popular"), className: "bg-orange-500" }
  }

  return null
}

export default function ProductOverview({
  product,
  colors,
  installments,
  buy,
  aside,
}: {
  product: HttpTypes.StoreProduct
  colors: ProductColor[]
  installments: number
  buy: ReactNode
  aside: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { addItem } = useKibisisCart()
  const t = useT()
  const money = useMoney()
  const [options, setOptions] = useState<Record<string, string>>({})
  const [activeImage, setActiveImage] = useState(0)
  const [hoverZoom, setHoverZoom] = useState<{ x: number; y: number } | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxLoaded, setLightboxLoaded] = useState(false)
  const [seededId, setSeededId] = useState<string | null>(null)

  useEffect(() => {
    const variantId = new URLSearchParams(window.location.search).get("v_id")
    const fromQuery = product.variants?.find((variant) => variant.id === variantId)
    const variant =
      fromQuery ?? (product.variants?.length === 1 ? product.variants[0] : undefined)
    setOptions(variant ? optionsAsKeymap(variant.options) : {})
    setSeededId(product.id)
  }, [product.id, product.variants])

  const selectedVariant = useMemo(() => {
    return (product.variants ?? []).find((variant) => {
      const map = optionsAsKeymap(variant.options)
      const mapKeys = Object.keys(map)
      const optionKeys = Object.keys(options)
      if (mapKeys.length !== optionKeys.length) {
        return false
      }

      return mapKeys.every((key) => map[key] === options[key])
    })
  }, [options, product.variants])

  useEffect(() => {
    if (seededId !== product.id) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    const value = selectedVariant?.id ?? null
    if ((params.get("v_id") ?? null) === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, product.id, router, searchParams, seededId, selectedVariant?.id])

  const partial = useMemo(
    () => (product.variants ?? []).filter((variant) => matchesPartial(variant, options)),
    [options, product.variants]
  )
  const galleryVariant =
    selectedVariant ?? partial.find((variant) => variant.images?.length)
  const swatch = (product.options ?? []).find((option) => isSwatch(option.title ?? ""))
  const swatchValue = swatch ? options[swatch.id] : undefined
  const namedImages = swatchValue ? imagesNamed(product, swatchValue) : []
  const gallery =
    namedImages.length && (!galleryVariant || sharesEveryImage(product, galleryVariant))
      ? namedImages.map((image) => ({ id: image.id, url: image.url }))
      : galleryOf(product, galleryVariant)
  const galleryKey = gallery.map((item) => item.id).join("|")
  const imageIndex = gallery[activeImage] ? activeImage : 0
  const image = gallery[imageIndex]
  const stepImage = (step: number) =>
    setActiveImage((imageIndex + step + gallery.length) % gallery.length)

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const justSwipedRef = useRef(false)
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const activeBtn = thumbnailRefs.current[imageIndex]
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      })
    }
  }, [imageIndex])

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      }
    }
  }

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) {
      return
    }
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y
    const deltaTime = Date.now() - touchStartRef.current.time
    touchStartRef.current = null

    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && deltaTime < 600) {
      justSwipedRef.current = true
      setTimeout(() => {
        justSwipedRef.current = false
      }, 150)
      if (deltaX < 0) {
        stepImage(1)
      } else {
        stepImage(-1)
      }
    }
  }

  const openLightbox = () => {
    if (justSwipedRef.current) {
      return
    }
    setHoverZoom(null)
    setLightboxLoaded(true)
    setLightboxOpen(true)
  }
  const trackZoom = (event: PointerEvent<HTMLDivElement>) => {
    const overControl = (event.target as HTMLElement).closest("[data-gallery-control]")
    if (event.pointerType !== "mouse" || overControl) {
      setHoverZoom(null)
      return
    }

    const box = event.currentTarget.getBoundingClientRect()
    setHoverZoom({
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    })
  }

  useEffect(() => {
    setActiveImage(0)
  }, [galleryKey])
  const price = variantPrice(selectedVariant) ?? cheapest(partial.length ? partial : (product.variants ?? []))
  const onSale = Boolean(price && price.original > price.price)
  const badge = saleBadge(product, onSale, t)
  const formatPrice = (amount: number) => money(amount, price?.currency)
  const rating = metaText(product.metadata, "rating")
  const reviewCount = metaText(product.metadata, "review_count")
  const sellerName = metaText(product.metadata, "seller_name")
  const sellerScore = metaText(product.metadata, "seller_score")
  const hasFacts = Boolean(rating || reviewCount || sellerName)
  const optionNames = (product.options ?? [])
    .map((option) => options[option.id])
    .filter((value): value is string => Boolean(value))
  const grouped = colors.length > 1
  const currentColor = colors.find((item) => item.product_id === product.id)
  const canAdd = Boolean(selectedVariant && price && inStock(selectedVariant))
  const needsChoice = (product.options?.length ?? 0) > 0 && !selectedVariant

  const addToCart = () => {
    if (!selectedVariant || !price || !inStock(selectedVariant)) {
      return
    }

    const title = product.title ?? ""
    addItem({
      variantId: selectedVariant.id,
      name: optionNames.length ? `${title} (${optionNames.join(" / ")})` : title,
      price: price.price,
    })
  }

  return (
    <section id="product-overview" className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 mx-auto w-full max-w-[480px] bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div
            className={`relative w-full aspect-[2/3] max-h-[670px] bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center select-none ${
              image ? "cursor-zoom-in" : ""
            }`}
            onPointerMove={image ? trackZoom : undefined}
            onPointerLeave={() => setHoverZoom(null)}
            onTouchStart={gallery.length > 1 ? handleTouchStart : undefined}
            onTouchEnd={gallery.length > 1 ? handleTouchEnd : undefined}
          >
            {image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={product.title ?? ""}
                  className="w-full h-full object-contain pointer-events-none select-none transition-transform duration-150 ease-out"
                  style={
                    hoverZoom
                      ? {
                          transform: `scale(${HOVER_ZOOM})`,
                          transformOrigin: `${hoverZoom.x}% ${hoverZoom.y}%`,
                        }
                      : undefined
                  }
                />
                <button
                  type="button"
                  aria-label={t("product.zoom_image")}
                  className="absolute inset-0 w-full h-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-orange-600"
                  onClick={openLightbox}
                />
              </>
            ) : null}
            {badge ? (
              <span
                className={`absolute top-3 left-3 pointer-events-none ${badge.className} text-white text-[10px] font-black px-2.5 py-1 rounded-md uppercase`}
              >
                {badge.label}
              </span>
            ) : null}
            {gallery.length > 1 ? (
              <>
                <button
                  type="button"
                  data-gallery-control
                  aria-label={t("product.previous_image")}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-orange-600 shadow-md border border-slate-200 flex items-center justify-center transition-colors z-10"
                  onClick={() => stepImage(-1)}
                >
                  <ThemeIcon name="chevron-left" className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  data-gallery-control
                  aria-label={t("product.next_image")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-orange-600 shadow-md border border-slate-200 flex items-center justify-center transition-colors z-10"
                  onClick={() => stepImage(1)}
                >
                  <ThemeIcon name="chevron-right" className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 right-3 pointer-events-none z-10 bg-slate-900/75 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 select-none">
                  <span>{imageIndex + 1}</span>
                  <span className="text-white/60">/</span>
                  <span>{gallery.length}</span>
                </div>
              </>
            ) : null}
          </div>
          {gallery.length > 1 ? (
            <div className="relative w-full">
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth">
                {gallery.map((thumb, index) => (
                  <button
                    key={thumb.id}
                    ref={(el) => {
                      thumbnailRefs.current[index] = el
                    }}
                    type="button"
                    aria-label={`${t("product.gallery")} ${index + 1}`}
                    className={`aspect-[2/3] w-14 sm:w-16 shrink-0 rounded-lg overflow-hidden border-2 bg-slate-100 transition-all ${
                      index === imageIndex
                        ? "border-orange-600 ring-2 ring-orange-600/20 shadow-xs"
                        : "border-slate-200 hover:border-slate-400 opacity-70 hover:opacity-100"
                    }`}
                    onClick={() => setActiveImage(index)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb.url} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div>
            {product.collection ? (
              <LocalizedClientLink
                href={`/collections/${product.collection.handle}`}
                className="text-orange-600 text-sm font-black uppercase"
              >
                {product.collection.title}
              </LocalizedClientLink>
            ) : null}
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {product.title}
            </h1>
          </div>

          {hasFacts ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pb-3 border-b border-slate-200">
              {rating ? (
                <span className="bg-amber-50 border border-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded">
                  {rating} ★
                </span>
              ) : null}
              {reviewCount ? <span>{t("product.reviews", { count: reviewCount })}</span> : null}
              {sellerName ? (
                <span>
                  {t("common.seller")}: <strong className="text-slate-900">{sellerName}</strong>
                  {sellerScore ? ` (${sellerScore})` : ""}
                </span>
              ) : null}
            </div>
          ) : null}

          {price ? (
            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 space-y-2">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-black text-slate-950">
                  {formatPrice(price.price)}
                </span>
                {onSale ? (
                  <span className="text-sm font-semibold text-slate-400 line-through">
                    {formatPrice(price.original)}
                  </span>
                ) : null}
                {onSale ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2 py-0.5 rounded-full">
                    {t("product.you_save", { amount: formatPrice(price.original - price.price) })}
                  </span>
                ) : null}
              </div>
              {installments >= 2 ? (
                <div className="text-xs font-semibold text-indigo-700 bg-white p-2 rounded-xl border border-slate-200">
                  {t("product.installments", {
                    count: installments,
                    amount: formatPrice(price.price / installments),
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {grouped ? (
            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-800">
                {t("product.color")}: <span className="font-normal text-slate-600">{currentColor?.color}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((item) => {
                  const selected = item.product_id === product.id

                  return (
                    <LocalizedClientLink
                      key={item.product_id}
                      href={`/products/${item.handle}`}
                      aria-current={selected ? "page" : undefined}
                      title={item.in_stock ? item.color : `${item.color} (${t("product.sold_out")})`}
                      className={`p-1.5 rounded-xl flex flex-col items-center min-w-[65px] border-2 transition-colors ${
                        selected
                          ? "border-orange-600 bg-orange-50/50"
                          : "border-slate-200 bg-white hover:border-orange-300"
                      } ${item.in_stock ? "" : "opacity-50"}`}
                    >
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="w-10 aspect-[2/3] rounded object-contain bg-slate-100"
                        />
                      ) : (
                        <span
                          className="w-10 aspect-[2/3] rounded bg-slate-100 border border-slate-200"
                          style={item.color_hex ? { backgroundColor: item.color_hex } : undefined}
                        />
                      )}
                      <span
                        className={`font-bold text-[10px] mt-1 ${item.in_stock ? "" : "line-through"}`}
                      >
                        {item.color}
                      </span>
                    </LocalizedClientLink>
                  )
                })}
              </div>
            </div>
          ) : null}

          {(product.options ?? []).map((option) => {
            const values = optionValues(product, option)
            if (!values.length) {
              return null
            }

            const current = options[option.id]
            const swatch = isSwatch(option.title ?? "")

            if (grouped && swatch) {
              return null
            }

            return (
              <div key={option.id} className="space-y-2 text-xs">
                <div className="font-bold text-slate-800">
                  {option.title}:{" "}
                  <span className="font-normal text-slate-600">{current ?? t("product.select")}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {values.map((value) => {
                    const selected = value === current
                    const thumb = swatch ? imageForValue(product, option.id, value) : undefined

                    if (swatch) {
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`p-1.5 rounded-xl flex flex-col items-center min-w-[65px] border-2 ${
                            selected
                              ? "border-orange-600 bg-orange-50/50"
                              : "border-slate-200 bg-white"
                          }`}
                          onClick={() =>
                            setOptions((previous) => ({ ...previous, [option.id]: value }))
                          }
                        >
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt="" className="w-10 aspect-[2/3] rounded object-contain bg-slate-100" />
                          ) : (
                            <span className="w-10 aspect-[2/3] rounded bg-slate-100" />
                          )}
                          <span className="font-bold text-[10px] mt-1">{value}</span>
                        </button>
                      )
                    }

                    return (
                      <button
                        key={value}
                        type="button"
                        className={`px-4 py-2 border rounded-xl font-bold ${
                          selected
                            ? "bg-orange-600 text-white border-orange-600"
                            : "border-slate-200"
                        }`}
                        onClick={() =>
                          setOptions((previous) => ({ ...previous, [option.id]: value }))
                        }
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <button
            type="button"
            disabled={!canAdd}
            className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-sm shadow-md transition-all"
            onClick={addToCart}
          >
            {canAdd
              ? t("product.add_to_cart")
              : needsChoice
                ? t("product.select_option")
                : t("product.out_of_stock")}
          </button>

          {buy ? <div className="kibi-product-slot space-y-4">{buy}</div> : null}
        </div>

        <aside className="lg:col-span-3 kibi-product-slot space-y-4 text-xs">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <ThemeIcon name="truck" className="h-4 w-4 text-orange-600" />
              {t("product.free_shipping_over", { amount: FREE_SHIPPING_FROM })}
            </div>
          </div>

          {price ? (
            <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-4 rounded-2xl text-white">
              <div className="font-black text-amber-200 text-[10px] flex items-center gap-1">
                <ThemeIcon name="sparkles" className="h-3.5 w-3.5" />
                PREMIUM
              </div>
              <p className="font-bold mt-1">
                {t("product.premium", { amount: formatPrice(price.price * PREMIUM_RATE) })}
              </p>
            </div>
          ) : null}

          {aside}
        </aside>
      </div>
      {lightboxLoaded && gallery.length ? (
        <ImageLightbox
          images={gallery}
          index={imageIndex}
          open={lightboxOpen}
          title={product.title ?? ""}
          onClose={() => setLightboxOpen(false)}
          onIndex={setActiveImage}
        />
      ) : null}
    </section>
  )
}
