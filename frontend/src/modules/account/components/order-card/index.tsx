import { Button } from "@modules/common/components/ui"
import { useMemo } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PlaceholderImage from "@modules/common/icons/placeholder-image"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type OrderCardProps = {
  order: HttpTypes.StoreOrder
}

function getResizedImageUrl(url?: string | null, width = 60, height = 90) {
  if (!url) return null
  try {
    const parsed = new URL(url, "http://dummy")
    parsed.searchParams.set("w", String(width))
    parsed.searchParams.set("h", String(height))
    return parsed.origin === "http://dummy"
      ? `${parsed.pathname}${parsed.search}`
      : parsed.toString()
  } catch {
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}w=${width}&h=${height}`
  }
}

const OrderCard = ({ order }: OrderCardProps) => {
  const numberOfLines = useMemo(() => {
    return (
      order.items?.reduce((acc, item) => {
        return acc + item.quantity
      }, 0) ?? 0
    )
  }, [order])

  const numberOfProducts = useMemo(() => {
    return order.items?.length ?? 0
  }, [order])

  return (
    <div className="bg-white flex flex-col" data-testid="order-card">
      <div className="uppercase text-large-semi mb-1">
        #<span data-testid="order-display-id">{order.display_id}</span>
      </div>
      <div className="flex items-center divide-x divide-gray-200 text-small-regular text-ui-fg-base">
        <span className="pr-2" data-testid="order-created-at">
          {new Date(order.created_at).toDateString()}
        </span>
        <span className="px-2" data-testid="order-amount">
          {convertToLocale({
            amount: order.total,
            currency_code: order.currency_code,
          })}
        </span>
        <span className="pl-2">{`${numberOfLines} ${
          numberOfLines > 1 ? "items" : "item"
        }`}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 my-4">
        {order.items?.slice(0, 4).map((i) => {
          const resizedThumbnail = getResizedImageUrl(i.thumbnail, 60, 90)
          return (
            <div
              key={i.id}
              className="flex items-center gap-x-3 bg-slate-50 border border-slate-200 rounded-xl p-2 pr-3.5"
              data-testid="order-item"
            >
              <div className="w-[60px] h-[90px] min-w-[60px] min-h-[90px] relative rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0">
                {resizedThumbnail ? (
                  <img
                    src={resizedThumbnail}
                    alt={i.title}
                    width={60}
                    height={90}
                    className="w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <PlaceholderImage size={16} />
                  </div>
                )}
              </div>
              <div className="flex flex-col text-small-regular text-ui-fg-base">
                <span
                  className="text-ui-fg-base font-semibold line-clamp-2 max-w-[170px] text-xs"
                  data-testid="item-title"
                  title={i.title}
                >
                  {i.title}
                </span>
                {i.variant_title && i.variant_title !== "Standart" && (
                  <span className="text-[11px] text-slate-400">
                    {i.variant_title}
                  </span>
                )}
                <span className="text-slate-500 text-xs mt-1">
                  x <span data-testid="item-quantity">{i.quantity}</span>
                </span>
              </div>
            </div>
          )
        })}
        {numberOfProducts > 4 && (
          <div className="flex flex-col items-center justify-center px-2">
            <span className="text-small-regular text-ui-fg-base font-semibold">
              + {numberOfLines - 4}
            </span>
            <span className="text-xs text-ui-fg-subtle">more</span>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <LocalizedClientLink href={`/account/orders/details/${order.id}`}>
          <Button data-testid="order-details-link" variant="secondary">
            See details
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default OrderCard
