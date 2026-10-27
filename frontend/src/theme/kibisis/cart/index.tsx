"use client"

import { applyPromotions } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

import type { Translate } from "../i18n"
import { useMoney, useT } from "../i18n/client"
import { ThemeIcon } from "../icons"
import { checkoutPathFor, useKibisisCart } from "../layout/shell/cart-context"

function sellerName(item: HttpTypes.StoreCartLineItem, t: Translate) {
  const value = item.product?.metadata?.seller_name
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  return t("cart.store")
}

function variantLabel(item: HttpTypes.StoreCartLineItem) {
  const title = item.variant_title
  if (!title || title === "Default Title" || title === "Default") {
    return ""
  }

  return title
}

function sessionLabel(
  cart: HttpTypes.StoreCart | null,
  customer: HttpTypes.StoreCustomer | null,
  t: Translate
) {
  if (customer) {
    const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ")
    return name ? `${name} · ${customer.email}` : customer.email
  }

  if (cart?.email) {
    return `${t("cart.guest")} · ${cart.email}`
  }

  return t("cart.guest_session")
}

function CartLine({
  item,
  currency,
}: {
  item: HttpTypes.StoreCartLineItem
  currency: string
}) {
  const { updateQuantity, pending } = useKibisisCart()
  const t = useT()
  const money = useMoney()
  const current = item.total ?? (item.unit_price ?? 0) * item.quantity
  const original = item.original_total ?? current
  const saving = original > current ? original - current : 0
  const label = variantLabel(item)

  return (
    <div className="py-3 flex flex-col sm:flex-row items-start justify-between gap-4 border-t border-slate-100">
      <div className="flex items-start gap-3 flex-1">
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className="w-20 h-24 rounded-xl bg-slate-100 overflow-hidden shrink-0"
        >
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt={item.product_title ?? ""}
              className="w-full h-full object-cover"
            />
          ) : null}
        </LocalizedClientLink>
        <div className="space-y-1 text-xs">
          <LocalizedClientLink
            href={`/products/${item.product_handle}`}
            className="font-bold text-slate-900 hover:text-orange-600 line-clamp-2"
          >
            {item.product_title || item.title}
          </LocalizedClientLink>
          {label ? <div className="text-[11px] text-slate-500">{label}</div> : null}
          <div className="flex items-center border rounded-lg bg-slate-50 w-28 justify-between px-2 py-1 mt-2">
            <button
              type="button"
              disabled={pending}
              className="text-slate-500 hover:text-red-500 font-bold disabled:opacity-40"
              onClick={() => updateQuantity(item.id, item.quantity - 1)}
              aria-label={t("cart.decrease")}
            >
              {item.quantity === 1 ? (
                <ThemeIcon name="trash" className="h-3.5 w-3.5" />
              ) : (
                "−"
              )}
            </button>
            <span className="font-bold text-xs">{item.quantity}</span>
            <button
              type="button"
              disabled={pending}
              className="text-orange-600 font-bold disabled:opacity-40"
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
              aria-label={t("cart.increase")}
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 w-full sm:w-auto">
        {saving > 0 ? (
          <div className="text-xs text-slate-400 line-through">
            {money(original, currency)}
          </div>
        ) : null}
        <div className="text-lg font-black text-slate-950">
          {money(current, currency)}
        </div>
        {saving > 0 ? (
          <div className="text-[11px] font-bold text-emerald-700">
            {t("cart.saved", { amount: money(saving, currency) })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function KibisisCartTemplate({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) {
  const t = useT()
  const money = useMoney()
  const router = useRouter()
  const { clearCart, pending } = useKibisisCart()
  const [code, setCode] = useState("")
  const [couponError, setCouponError] = useState("")
  const [couponPending, setCouponPending] = useState(false)
  const items = cart?.items ?? []
  const currency = cart?.currency_code || "try"
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const promotions = (cart?.promotions ?? []).filter((promotion) => promotion.code)
  const groups = new Map<string, HttpTypes.StoreCartLineItem[]>()

  for (const item of items) {
    const seller = sellerName(item, t)
    const group = groups.get(seller) ?? []
    group.push(item)
    groups.set(seller, group)
  }

  const hasShipping = (cart?.shipping_methods?.length ?? 0) > 0
  const itemSubtotal = cart?.item_subtotal ?? 0
  const discount = cart?.discount_total ?? 0
  const shipping = cart?.shipping_subtotal ?? 0
  const total = cart?.total ?? itemSubtotal
  const saving = items.reduce((sum, item) => {
    const current = item.total ?? 0
    const original = item.original_total ?? current
    return sum + Math.max(0, original - current)
  }, 0)

  const applyCode = async (event: FormEvent) => {
    event.preventDefault()
    const next = code.trim()
    if (!next || !cart) {
      return
    }

    const codes = promotions
      .map((promotion) => promotion.code)
      .filter((value): value is string => Boolean(value))

    setCouponError("")
    setCouponPending(true)
    try {
      await applyPromotions([...codes, next])
      setCode("")
      router.refresh()
    } catch (error) {
      setCouponError(error instanceof Error ? error.message : t("cart.coupon_apply_failed"))
    } finally {
      setCouponPending(false)
    }
  }

  const removeCode = async (promoCode: string) => {
    const codes = promotions
      .map((promotion) => promotion.code)
      .filter((value): value is string => Boolean(value) && value !== promoCode)

    setCouponError("")
    setCouponPending(true)
    try {
      await applyPromotions(codes)
      router.refresh()
    } catch (error) {
      setCouponError(error instanceof Error ? error.message : t("cart.coupon_remove_failed"))
    } finally {
      setCouponPending(false)
    }
  }

  return (
    <div>
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">{t("cart.title")}</h1>
              <span className="text-xs font-semibold text-slate-500">
                {t("cart.items_count", { count })}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              {t("cart.session", { session: sessionLabel(cart, customer, t) })}
            </p>
          </div>
          {count > 0 ? (
            <button
              type="button"
              disabled={pending}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 disabled:opacity-40"
              onClick={clearCart}
            >
              <span>{t("cart.remove_items")}</span>
              <ThemeIcon name="trash" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {count === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <ThemeIcon name="shopping-bag" className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-bold text-slate-800">{t("cart.empty")}</p>
            <p className="text-xs text-slate-500 mt-1">
              {t("cart.empty_hint")}
            </p>
            <LocalizedClientLink
              href="/"
              className="inline-flex mt-5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm px-5 py-3 rounded-xl"
            >
              {t("cart.continue")}
            </LocalizedClientLink>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-5">
              <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ThemeIcon name="tag" className="h-3.5 w-3.5 text-orange-600" />
                    {t("cart.coupons", { count: promotions.length })}
                  </div>
                </div>
                <form onSubmit={applyCode} className="flex gap-2">
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder={t("cart.coupon_code")}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-orange-500 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={couponPending || !code.trim()}
                    className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold disabled:opacity-40"
                  >
                    {t("cart.apply")}
                  </button>
                </form>
                {couponError ? (
                  <p className="text-[11px] font-semibold text-red-600">{couponError}</p>
                ) : null}
                {promotions.map((promotion) => (
                  <div
                    key={promotion.id}
                    className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-black text-amber-950">{promotion.code}</div>
                      {promotion.is_automatic ? (
                        <div className="text-[11px] text-slate-500 mt-0.5">{t("cart.auto_applied")}</div>
                      ) : null}
                    </div>
                    {!promotion.is_automatic && promotion.code ? (
                      <button
                        type="button"
                        disabled={couponPending}
                        className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs"
                        onClick={() => removeCode(promotion.code as string)}
                      >
                        {t("cart.remove")}
                      </button>
                    ) : null}
                  </div>
                ))}
              </section>

              {Array.from(groups.entries()).map(([seller, lines]) => (
                <section
                  key={seller}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
                    <div className="font-bold text-slate-900">
                      {t("common.seller")}: <strong>{seller}</strong>
                    </div>
                    {hasShipping && shipping === 0 ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                        {t("common.free_shipping")}
                      </span>
                    ) : null}
                  </div>
                  {lines.map((item) => (
                    <CartLine key={item.id} item={item} currency={currency} />
                  ))}
                </section>
              ))}
            </div>

            <aside className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    {t("cart.selected", { count })}
                  </div>
                  <div className="text-3xl font-black text-slate-950">
                    {money(total, currency)}
                  </div>
                  {saving > 0 ? (
                    <div className="text-xs text-emerald-700 font-bold">
                      {t("cart.you_save", { amount: money(saving, currency) })}
                    </div>
                  ) : null}
                </div>
                <LocalizedClientLink
                  href={checkoutPathFor(cart)}
                  className="flex w-full items-center justify-center py-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm tracking-wide shadow-md"
                >
                  {t("cart.checkout")}
                </LocalizedClientLink>
                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>{t("cart.items")}</span>
                    <strong className="text-slate-900">{money(itemSubtotal, currency)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("cart.shipping")}</span>
                    <strong className="text-slate-900">
                      {!hasShipping
                        ? t("cart.at_checkout")
                        : shipping === 0
                          ? t("cart.free")
                          : money(shipping, currency)}
                    </strong>
                  </div>
                  {discount > 0 ? (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>{t("cart.discount")}</span>
                      <span>-{money(discount, currency)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-2 border-t text-sm font-black text-slate-950">
                    <span>{t("cart.total")}</span>
                    <span>{money(total, currency)}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
