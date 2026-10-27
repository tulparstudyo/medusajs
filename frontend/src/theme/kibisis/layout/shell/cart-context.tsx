"use client"

import { addToCart, deleteLineItem, updateLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useT } from "../../i18n/client"
import type { ThemeIconName } from "../../icons"

export type KibisisCartItem = {
  id: string
  variantId?: string
  name: string
  price: number
  quantity: number
}

type ToastState = {
  message: string
  icon: ThemeIconName
  visible: boolean
}

type AddInput = {
  variantId?: string
  name: string
  price: number
}

type KibisisCartContextValue = {
  items: KibisisCartItem[]
  count: number
  total: number
  currency: string | undefined
  checkoutPath: string
  drawerOpen: boolean
  toast: ToastState
  pending: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (item: AddInput) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  showToast: (message: string, icon?: ThemeIconName) => void
}

const KibisisCartContext = createContext<KibisisCartContextValue | null>(null)

export function checkoutPathFor(
  cart: HttpTypes.StoreCart | null | undefined
) {
  if (!cart?.email || !cart.shipping_address?.address_1) {
    return "/checkout?step=address"
  }

  if (!cart.shipping_methods?.length) {
    return "/checkout?step=delivery"
  }

  return "/checkout?step=payment"
}

function lineName(item: HttpTypes.StoreCartLineItem, fallback: string) {
  const title = item.product_title || item.title || fallback
  const variant = item.variant_title
  if (!variant || variant === "Default Title" || variant === "Default") {
    return title
  }

  return `${title} (${variant})`
}

function linePrice(item: HttpTypes.StoreCartLineItem) {
  if (typeof item.unit_price === "number") {
    return item.unit_price
  }

  if (typeof item.total === "number" && item.quantity > 0) {
    return item.total / item.quantity
  }

  return 0
}

export function sessionItems(
  cart: HttpTypes.StoreCart | null | undefined,
  fallback: string
): KibisisCartItem[] {
  return (cart?.items ?? []).map((item) => ({
    id: item.id,
    variantId: item.variant_id ?? undefined,
    name: lineName(item, fallback),
    price: linePrice(item),
    quantity: item.quantity,
  }))
}

function cartKey(cart: HttpTypes.StoreCart | null | undefined) {
  return (cart?.items ?? [])
    .map((item) => `${item.id}:${item.quantity}:${item.total ?? ""}`)
    .join("|")
}

export function KibisisCartProvider({
  cart,
  children,
}: {
  cart: HttpTypes.StoreCart | null
  children: ReactNode
}) {
  const router = useRouter()
  const params = useParams()
  const countryCode = String(params.countryCode || "")
  const t = useT()
  const fallbackName = t("cart.product_fallback")
  const [items, setItems] = useState<KibisisCartItem[]>(() => sessionItems(cart, fallbackName))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<ToastState>({
    message: t("toast.added"),
    icon: "check",
    visible: false,
  })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const key = cartKey(cart)

  useEffect(() => {
    setItems(sessionItems(cart, fallbackName))
  }, [key, cart, fallbackName])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const showToast = useCallback((message: string, icon: ThemeIconName = "check") => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, icon, visible: true })
    toastTimer.current = setTimeout(() => {
      setToast((current) => ({ ...current, visible: false }))
    }, 2500)
  }, [])

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  const addItem = useCallback(
    (item: AddInput) => {
      if (!item.variantId) {
        showToast(t("toast.cannot_add"), "x-mark")
        return
      }

      if (!countryCode) {
        showToast(t("toast.no_country"), "x-mark")
        return
      }

      const snapshot = itemsRef.current
      setItems((current) => {
        const existing = current.find((line) => line.variantId === item.variantId)
        if (existing) {
          return current.map((line) =>
            line.variantId === item.variantId
              ? { ...line, quantity: line.quantity + 1 }
              : line
          )
        }

        return [
          ...current,
          {
            id: item.variantId as string,
            variantId: item.variantId,
            name: item.name,
            price: item.price,
            quantity: 1,
          },
        ]
      })
      showToast(t("toast.added_named", { name: item.name.substring(0, 24) }))
      setPending(true)

      void addToCart({
        variantId: item.variantId,
        quantity: 1,
        countryCode,
      })
        .then(() => {
          refresh()
        })
        .catch((error: unknown) => {
          setItems(snapshot)
          showToast(
            error instanceof Error ? error.message : t("toast.add_failed"),
            "x-mark"
          )
        })
        .finally(() => {
          setPending(false)
        })
    },
    [countryCode, refresh, showToast, t]
  )

  const removeItem = useCallback(
    (id: string) => {
      const snapshot = itemsRef.current
      const line = snapshot.find((item) => item.id === id)
      if (!line) {
        return
      }

      setItems((current) => current.filter((item) => item.id !== id))
      setPending(true)

      void deleteLineItem(id)
        .then(() => {
          showToast(t("toast.removed"), "trash")
          refresh()
        })
        .catch((error: unknown) => {
          setItems(snapshot)
          showToast(
            error instanceof Error ? error.message : t("toast.remove_failed"),
            "x-mark"
          )
        })
        .finally(() => {
          setPending(false)
        })
    },
    [refresh, showToast, t]
  )

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (quantity < 1) {
        removeItem(id)
        return
      }

      const snapshot = itemsRef.current
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, quantity } : item))
      )
      setPending(true)

      void updateLineItem({ lineId: id, quantity })
        .then(() => {
          refresh()
        })
        .catch((error: unknown) => {
          setItems(snapshot)
          showToast(
            error instanceof Error ? error.message : t("toast.quantity_failed"),
            "x-mark"
          )
        })
        .finally(() => {
          setPending(false)
        })
    },
    [refresh, removeItem, showToast, t]
  )

  const clearCart = useCallback(() => {
    const snapshot = itemsRef.current
    if (!snapshot.length) {
      return
    }

    setItems([])
    setPending(true)

    void Promise.all(snapshot.map((item) => deleteLineItem(item.id)))
      .then(() => {
        showToast(t("toast.cleared"), "trash")
        refresh()
      })
      .catch((error: unknown) => {
        setItems(snapshot)
        showToast(
          error instanceof Error ? error.message : t("toast.clear_failed"),
          "x-mark"
        )
      })
      .finally(() => {
        setPending(false)
      })
  }, [refresh, showToast, t])

  const openCart = useCallback(() => setDrawerOpen(true), [])
  const closeCart = useCallback(() => setDrawerOpen(false), [])

  const value = useMemo<KibisisCartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      currency: cart?.currency_code,
      checkoutPath: checkoutPathFor(cart),
      drawerOpen,
      toast,
      pending,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      showToast,
    }),
    [
      items,
      cart,
      drawerOpen,
      toast,
      pending,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      showToast,
    ]
  )

  return (
    <KibisisCartContext.Provider value={value}>
      {children}
    </KibisisCartContext.Provider>
  )
}

export function useKibisisCart() {
  const context = useContext(KibisisCartContext)

  if (!context) {
    throw new Error("useKibisisCart must be used within KibisisCartProvider")
  }

  return context
}
