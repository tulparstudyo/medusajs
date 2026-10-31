import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  DropdownMenu,
  Heading,
  Prompt,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ArrowPath,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FlyingBox,
  ShoppingCart,
} from "@medusajs/icons"
import { OrderDTO, OrderFilterTab } from "../types"
import {
  createBulkShipmentsApi,
  fetchActiveCarrier,
  fetchOrders,
  formatDate,
  formatPrice,
} from "./api"
import { CarrierCell } from "./components/carrier-cell"
import { OrderFilters } from "./components/order-filters"

export default function OrderListScreen() {
  const navigate = useNavigate()

  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // Filters & Pagination
  const [currentTab, setCurrentTab] = useState<OrderFilterTab>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [page, setPage] = useState<number>(1)
  const pageSize = 15

  // Bulk Selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [activeCarrier, setActiveCarrier] = useState<{ id: string; label: string } | null>(null)
  const [isCargoPromptOpen, setIsCargoPromptOpen] = useState<boolean>(false)
  const [processingCargo, setProcessingCargo] = useState<boolean>(false)

  useEffect(() => {
    fetchActiveCarrier().then(setActiveCarrier)
  }, [])

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetchOrders({
        limit: 100, // Fetch top 100 to allow smooth tab filtering client-side
        offset: 0,
      })
      setOrders(response.orders || [])
      setTotalCount(response.count || (response.orders ? response.orders.length : 0))
    } catch (err: any) {
      toast.error(err.message || "Siparişler yüklenirken bir hata oluştu.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Filtered orders based on Tab and Search query
  const filteredOrders = useMemo(() => {
    let result = orders

    // Tab filter
    if (currentTab === "unfulfilled") {
      result = result.filter(
        (o) =>
          o.fulfillment_status === "not_fulfilled" ||
          !o.fulfillments ||
          o.fulfillments.length === 0
      )
    } else if (currentTab === "fulfilled") {
      result = result.filter(
        (o) =>
          o.fulfillment_status === "fulfilled" ||
          o.fulfillment_status === "shipped" ||
          o.fulfillment_status === "partially_shipped" ||
          (o.fulfillments && o.fulfillments.length > 0)
      )
    } else if (currentTab === "delivered") {
      result = result.filter((o) => o.fulfillment_status === "delivered")
    } else if (currentTab === "awaiting_payment") {
      result = result.filter(
        (o) => o.payment_status === "awaiting" || o.payment_status === "not_paid"
      )
    } else if (currentTab === "refunded") {
      result = result.filter(
        (o) =>
          o.payment_status === "refunded" ||
          o.payment_status === "partially_refunded" ||
          o.status === "refunded"
      )
    } else if (currentTab === "canceled") {
      result = result.filter(
        (o) => o.status === "canceled" || o.fulfillment_status === "canceled"
      )
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((o) => {
        const idMatch = String(o.display_id || "").includes(query)
        const emailMatch = (o.email || "").toLowerCase().includes(query)
        const nameMatch = `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`
          .toLowerCase()
          .includes(query)
        const shippingName = `${o.shipping_address?.first_name || ""} ${o.shipping_address?.last_name || ""}`
          .toLowerCase()
          .includes(query)
        const cityMatch = (o.shipping_address?.city || "").toLowerCase().includes(query)

        return idMatch || emailMatch || nameMatch || shippingName || cityMatch
      })
    }

    return result
  }, [orders, currentTab, searchQuery])

  // Paginated slice
  const paginatedOrders = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredOrders.slice(startIndex, startIndex + pageSize)
  }, [filteredOrders, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))

  // Selection calculations
  const isAllSelected = useMemo(() => {
    if (paginatedOrders.length === 0) return false
    return paginatedOrders.every((order) => selectedOrderIds.has(order.id))
  }, [paginatedOrders, selectedOrderIds])

  const isSomeSelected = useMemo(() => {
    return (
      paginatedOrders.some((order) => selectedOrderIds.has(order.id)) && !isAllSelected
    )
  }, [paginatedOrders, selectedOrderIds, isAllSelected])

  const handleToggleSelectAll = () => {
    const next = new Set(selectedOrderIds)
    if (isAllSelected) {
      paginatedOrders.forEach((o) => next.delete(o.id))
    } else {
      paginatedOrders.forEach((o) => next.add(o.id))
    }
    setSelectedOrderIds(next)
  }

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedOrderIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedOrderIds(next)
  }

  const handleClearSelection = () => {
    setSelectedOrderIds(new Set())
  }

  const handleOpenCargoModal = async () => {
    try {
      const carrier = await fetchActiveCarrier()
      if (carrier) setActiveCarrier(carrier)
    } catch {
      // ignore
    }
    setIsCargoPromptOpen(true)
  }

  const handleConfirmCreateCargo = async () => {
    if (selectedOrderIds.size === 0) return

    setProcessingCargo(true)
    const orderIds = Array.from(selectedOrderIds)

    try {
      const res = await createBulkShipmentsApi(orderIds)
      if (res.processedCount > 0) {
        toast.success(
          `${res.processedCount} adet sipariş için ${res.activeCarrier} kargo kaydı açıldı!`
        )
      }
      if (res.errors && res.errors.length > 0) {
        toast.error(
          `${res.errors.length} sipariş için kargo kaydı açılamadı: ${res.errors[0].message}`
        )
      }
      setSelectedOrderIds(new Set())
      await loadData(true)
    } catch (err: any) {
      toast.error(err.message || "Kargo kayıtları oluşturulurken hata meydana geldi.")
    } finally {
      setProcessingCargo(false)
      setIsCargoPromptOpen(false)
    }
  }

  // Helper for Payment Status Badge
  const renderPaymentBadge = (status?: string) => {
    switch (status) {
      case "captured":
        return <Badge size="small" color="green">Ödendi</Badge>
      case "awaiting":
        return <Badge size="small" color="orange">Ödeme Bekliyor</Badge>
      case "not_paid":
        return <Badge size="small" color="red">Ödenmedi</Badge>
      case "refunded":
        return <Badge size="small" color="grey">İade Edildi</Badge>
      case "partially_refunded":
        return <Badge size="small" color="purple">Kısmi İade</Badge>
      default:
        return <Badge size="small" color="grey">{status || "Belirsiz"}</Badge>
    }
  }

  return (
    <Container className="p-0 overflow-hidden divide-y divide-ui-border-base border border-ui-border-base rounded-xl shadow-xs">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 bg-ui-bg-base">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-ui-bg-subtle flex items-center justify-center text-ui-fg-base border border-ui-border-base">
            <ShoppingCart className="w-5 h-5 text-ui-fg-interactive" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Heading level="h2" className="text-base font-semibold">
                Siparişler
              </Heading>
              <Badge size="small" color="blue" className="text-[11px] font-mono">
                Kibisis Özel Tema
              </Badge>
            </div>
            <Text size="small" className="text-ui-fg-muted">
              Tüm siparişleri, ödeme durumlarını ve kargo takip numaralarını yönetin.
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5"
          >
            <ArrowPath className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-6 py-3 bg-ui-bg-base">
        <OrderFilters
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab)
            setPage(1)
          }}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q)
            setPage(1)
          }}
          totalCount={totalCount}
        />
      </div>

      {/* Bulk Action Bar */}
      {selectedOrderIds.size > 0 && (
        <div className="flex items-center justify-between px-6 py-2.5 bg-ui-bg-subtle border-b border-ui-border-base transition-all">
          <div className="flex items-center gap-2">
            <Badge size="small" color="blue" className="font-medium">
              {selectedOrderIds.size} sipariş seçildi
            </Badge>
            <Button
              size="small"
              variant="transparent"
              onClick={handleClearSelection}
              className="text-xs text-ui-fg-muted hover:text-ui-fg-base"
            >
              Seçimi Temizle
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button size="small" variant="secondary" className="text-xs flex items-center gap-1.5">
                  Toplu İşlemler
                  <ChevronDown className="w-3.5 h-3.5 text-ui-fg-muted" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" className="w-48">
                <DropdownMenu.Item
                  onClick={handleOpenCargoModal}
                  className="flex items-center gap-2 cursor-pointer text-xs"
                >
                  <FlyingBox className="w-4 h-4 text-ui-fg-interactive" />
                  Kargo Kaydı Aç
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="overflow-x-auto bg-ui-bg-base">
        <Table>
          <Table.Header>
            <Table.Row className="bg-ui-bg-subtle/40 border-b border-ui-border-base">
              <Table.HeaderCell className="w-12 py-3 pl-6">
                <div className="flex items-center">
                  <Checkbox
                    checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Tümünü seç"
                  />
                </div>
              </Table.HeaderCell>
              <Table.HeaderCell className="w-24 font-semibold text-xs py-3">
                Sipariş
              </Table.HeaderCell>
              <Table.HeaderCell className="w-40 font-semibold text-xs py-3">
                Tarih
              </Table.HeaderCell>
              <Table.HeaderCell className="font-semibold text-xs py-3">
                Müşteri
              </Table.HeaderCell>
              <Table.HeaderCell className="w-32 font-semibold text-xs py-3">
                Ödeme
              </Table.HeaderCell>
              <Table.HeaderCell className="w-56 font-semibold text-xs py-3">
                Kargo & Takip No
              </Table.HeaderCell>
              <Table.HeaderCell className="w-32 font-semibold text-xs py-3 text-right">
                Toplam
              </Table.HeaderCell>
              <Table.HeaderCell className="w-16 font-semibold text-xs py-3 pr-6 text-center">
                İşlem
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {loading ? (
              <Table.Row>
                <td colSpan={8} className="text-center py-12 text-ui-fg-muted">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ArrowPath className="w-5 h-5 animate-spin text-ui-fg-interactive" />
                    <Text size="small">Siparişler yükleniyor...</Text>
                  </div>
                </td>
              </Table.Row>
            ) : paginatedOrders.length === 0 ? (
              <Table.Row>
                <td colSpan={8} className="text-center py-12 text-ui-fg-muted">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Text size="small" className="font-medium text-ui-fg-base">
                      Sipariş bulunamadı
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle text-xs">
                      {searchQuery
                        ? "Arama kriterlerinize uygun sipariş kaydı yok."
                        : "Seçilen sekmede kayıtlı sipariş bulunmuyor."}
                    </Text>
                  </div>
                </td>
              </Table.Row>
            ) : (
              paginatedOrders.map((order) => {
                const customerName =
                  [order.customer?.first_name, order.customer?.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                  [order.shipping_address?.first_name, order.shipping_address?.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                  "-"

                const isSelected = selectedOrderIds.has(order.id)

                return (
                  <Table.Row
                    key={order.id}
                    onClick={() => navigate(`/kibisis/orders/${order.id}`)}
                    className={`cursor-pointer hover:bg-ui-bg-subtle-hover transition-colors group ${
                      isSelected ? "bg-ui-bg-highlight/30" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <Table.Cell className="pl-6 w-12" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectOne(order.id)}
                          aria-label={`Sipariş #${order.display_id} seç`}
                        />
                      </div>
                    </Table.Cell>

                    {/* Order ID */}
                    <Table.Cell className="font-mono font-semibold text-xs text-ui-fg-base">
                      <span className="text-ui-fg-interactive group-hover:underline">
                        #{order.display_id}
                      </span>
                    </Table.Cell>

                    {/* Date */}
                    <Table.Cell className="text-xs text-ui-fg-subtle">
                      {formatDate(order.created_at)}
                    </Table.Cell>

                    {/* Customer */}
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-ui-fg-base truncate max-w-[200px]">
                          {customerName}
                        </span>
                        <span className="text-[11px] text-ui-fg-muted truncate max-w-[200px]">
                          {order.email || "-"}
                        </span>
                      </div>
                    </Table.Cell>

                    {/* Payment Status */}
                    <Table.Cell>
                      {renderPaymentBadge(order.payment_status)}
                    </Table.Cell>

                    {/* Cargo / Tracking (CUSTOM COLUMN) */}
                    <Table.Cell>
                      <CarrierCell order={order} />
                    </Table.Cell>

                    {/* Total Price */}
                    <Table.Cell className="text-right font-medium text-xs text-ui-fg-base">
                      {formatPrice(order.total, order.currency_code)}
                    </Table.Cell>

                    {/* Quick Action */}
                    <Table.Cell className="pr-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        variant="transparent"
                        onClick={() => navigate(`/kibisis/orders/${order.id}`)}
                        className="p-1.5 text-ui-fg-muted hover:text-ui-fg-base rounded-md"
                        title="Sipariş Detayını Görüntüle"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
          </Table.Body>
        </Table>
      </div>

      {/* Pagination Footer */}
      {!loading && filteredOrders.length > 0 && (
        <div className="flex items-center justify-between px-6 py-3 bg-ui-bg-base text-xs text-ui-fg-muted">
          <span>
            Toplam <strong className="text-ui-fg-base">{filteredOrders.length}</strong> siparişten{" "}
            <strong>{(page - 1) * pageSize + 1}</strong> -{" "}
            <strong>{Math.min(page * pageSize, filteredOrders.length)}</strong> arası gösteriliyor
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              size="small"
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 h-7 w-7"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2 font-medium text-ui-fg-base">
              {page} / {totalPages}
            </span>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 h-7 w-7"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Cargo Confirmation Modal */}
      <Prompt open={isCargoPromptOpen} onOpenChange={setIsCargoPromptOpen}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Toplu Kargo Kaydı Açma Onayı</Prompt.Title>
            <Prompt.Description>
              Seçilen <strong>{selectedOrderIds.size}</strong> adet sipariş için{" "}
              <span className="font-semibold text-ui-fg-base">
                [app/kibisettings/carriers]
              </span>{" "}
              bölümünde aktif olan{" "}
              <strong>{activeCarrier?.label || "Aktif Kargo Firması"}</strong>{" "}
              üzerinden gönderi kaydı açılacaktır. Devam etmek istiyor musunuz?
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel disabled={processingCargo}>Vazgeç</Prompt.Cancel>
            <Prompt.Action
              onClick={handleConfirmCreateCargo}
              disabled={processingCargo}
            >
              {processingCargo ? "Kayıt Açılıyor..." : "Evet, Kargo Kaydı Aç"}
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}
