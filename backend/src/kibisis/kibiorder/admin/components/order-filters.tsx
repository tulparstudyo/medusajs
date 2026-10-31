import React from "react"
import { Input, Select } from "@medusajs/ui"
import { MagnifyingGlass, XMark } from "@medusajs/icons"
import { OrderFilterTab } from "../../types"

interface OrderFiltersProps {
  currentTab: OrderFilterTab
  onTabChange: (tab: OrderFilterTab) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  totalCount?: number
}

export const OrderFilters: React.FC<OrderFiltersProps> = ({
  currentTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  totalCount,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ui-border-base pb-3">
      {/* Status Select Filter */}
      <div className="flex items-center gap-2">
        <div className="w-60">
          <Select
            value={currentTab}
            onValueChange={(val) => onTabChange(val as OrderFilterTab)}
            size="small"
          >
            <Select.Trigger className="bg-ui-bg-base text-xs">
              <Select.Value placeholder="Sipariş Durumu Seçin" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">
                Tüm Siparişler {totalCount !== undefined ? `(${totalCount})` : ""}
              </Select.Item>
              <Select.Item value="unfulfilled">📦 Kargo Bekleyen</Select.Item>
              <Select.Item value="fulfilled">🚚 Kargoda</Select.Item>
              <Select.Item value="delivered">✅ Teslim Edildi</Select.Item>
              <Select.Item value="awaiting_payment">⏳ Ödeme Bekleyen</Select.Item>
              <Select.Item value="refunded">🔄 İade Edildi</Select.Item>
              <Select.Item value="canceled">❌ İptal Edilenler</Select.Item>
            </Select.Content>
          </Select>
        </div>

        {currentTab !== "all" && (
          <button
            type="button"
            onClick={() => onTabChange("all")}
            className="text-[11px] text-ui-fg-muted hover:text-ui-fg-base px-2 py-1 rounded bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover transition-colors"
          >
            Filtreyi Sıfırla
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative w-full sm:w-72">
        <Input
          size="small"
          placeholder="Sipariş no, müşteri veya e-posta..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 pr-7 text-xs bg-ui-bg-base"
        />
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ui-fg-muted">
          <MagnifyingGlass className="w-3.5 h-3.5" />
        </div>
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ui-fg-muted hover:text-ui-fg-base p-0.5 rounded transition-colors"
          >
            <XMark className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}


