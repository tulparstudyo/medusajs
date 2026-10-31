import React from "react"
import { Badge, Tooltip } from "@medusajs/ui"
import { ArrowUpRightOnBox, FlyingBox } from "@medusajs/icons"
import { OrderDTO } from "../../types"
import { extractTrackingDetails } from "../api"

interface CarrierCellProps {
  order: OrderDTO
}

export const CarrierCell: React.FC<CarrierCellProps> = ({ order }) => {
  const trackingList = extractTrackingDetails(order)

  if (trackingList.length === 0) {
    const isDelivered = order.fulfillment_status === "delivered"
    const isShipped =
      order.fulfillment_status === "shipped" ||
      order.fulfillment_status === "partially_shipped"

    if (isDelivered) {
      return (
        <Badge size="small" color="green" className="font-medium">
          Teslim Edildi
        </Badge>
      )
    }

    if (isShipped) {
      return (
        <Badge size="small" color="blue" className="font-medium">
          Kargoda
        </Badge>
      )
    }

    return (
      <span className="text-ui-fg-muted text-xs inline-flex items-center gap-1">
        <FlyingBox className="w-3.5 h-3.5 text-ui-fg-subtle" />
        Bekliyor
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      {trackingList.map((item, index) => {
        if (!item.trackingUrl) {
          return (
            <Badge
              key={index}
              size="small"
              color="purple"
              className="font-mono text-[11px] select-all"
            >
              <span className="font-semibold mr-1">{item.carrierLabel}:</span>
              {item.trackingNumber}
            </Badge>
          )
        }

        return (
          <Tooltip
            key={index}
            content={`${item.carrierLabel} ile kargo takibini aç (Yeni Sekme)`}
          >
            <a
              href={item.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover text-ui-fg-base border border-ui-border-base transition-colors group"
            >
              <span className="font-semibold text-ui-fg-subtle group-hover:text-ui-fg-base">
                {item.carrierLabel}:
              </span>
              <span className="font-mono font-medium text-ui-fg-interactive select-all underline decoration-dotted">
                {item.trackingNumber}
              </span>
              <ArrowUpRightOnBox className="w-3 h-3 text-ui-fg-muted group-hover:text-ui-fg-base transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </Tooltip>
        )
      })}
    </div>
  )
}

