import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ArrowLeft,
  ArrowUpRightOnBox,
  FlyingBox,
  MapPin,
  ReceiptPercent,
  ShoppingCart,
  User,
} from "@medusajs/icons"
import { OrderDTO } from "../types"
import {
  extractTrackingDetails,
  fetchOrderById,
  fetchOrderShipments,
  formatDate,
  formatPrice,
} from "./api"

export default function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [order, setOrder] = useState<OrderDTO | null>(null)
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!id) return

    let isMounted = true
    setLoading(true)

    Promise.all([
      fetchOrderById(id),
      fetchOrderShipments(id).catch(() => []),
    ])
      .then(([orderData, shipmentsData]) => {
        if (isMounted) {
          setOrder(orderData)
          setShipments(shipmentsData)
        }
      })
      .catch((err) => {
        toast.error(err.message || "Sipariş detayları yüklenemedi.")
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [id])

  if (loading) {
    return (
      <Container className="p-12 text-center">
        <Text size="small" className="text-ui-fg-muted">
          Sipariş detayları yükleniyor...
        </Text>
      </Container>
    )
  }

  if (!order) {
    return (
      <Container className="p-12 text-center">
        <Text size="small" className="text-ui-fg-muted mb-4">
          Sipariş bulunamadı.
        </Text>
        <Button size="small" variant="secondary" onClick={() => navigate("/kibisis/orders")}>
          Sipariş Listesine Dön
        </Button>
      </Container>
    )
  }

  const trackingList = extractTrackingDetails(order)

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            size="small"
            variant="secondary"
            onClick={() => navigate("/kibisis/orders")}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Siparişler
          </Button>

          <div className="h-4 w-px bg-ui-border-base" />

          <div>
            <div className="flex items-center gap-2">
              <Heading level="h1" className="text-lg font-bold">
                Sipariş #{order.display_id}
              </Heading>
              <Badge size="small" color="blue" className="text-[11px] font-mono">
                Kibisis Özel Görünüm
              </Badge>
            </div>
            <Text size="small" className="text-ui-fg-muted text-xs">
              Oluşturulma: {formatDate(order.created_at)}
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {order.payment_status === "captured" ? (
            <Badge size="small" color="green">Ödeme Alındı</Badge>
          ) : (
            <Badge size="small" color="orange">{order.payment_status || "Bekliyor"}</Badge>
          )}

          {order.fulfillment_status === "delivered" ? (
            <Badge size="small" color="green">Teslim Edildi</Badge>
          ) : order.fulfillment_status === "shipped" ? (
            <Badge size="small" color="blue">Kargoda</Badge>
          ) : (
            <Badge size="small" color="grey">Kargo Bekliyor</Badge>
          )}
        </div>
      </div>

      {/* Main Grid: Left Items & Summary / Right Shipping & Customer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Items & Payment Summary */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Order Items Table Card */}
          <Container className="p-0 overflow-hidden border border-ui-border-base rounded-xl">
            <div className="px-6 py-4 border-b border-ui-border-base bg-ui-bg-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-ui-fg-subtle" />
                <Heading level="h3" className="text-sm font-semibold">
                  Sipariş Edilen Ürünler
                </Heading>
              </div>
              <Badge size="small" color="grey">
                {order.items?.length || 0} Ürün
              </Badge>
            </div>

            <div className="overflow-x-auto bg-ui-bg-base">
              <Table>
                <Table.Header>
                  <Table.Row className="bg-ui-bg-subtle/30 text-xs">
                    <Table.HeaderCell className="pl-6 py-2.5">Ürün</Table.HeaderCell>
                    <Table.HeaderCell className="w-24 text-center py-2.5">Adet</Table.HeaderCell>
                    <Table.HeaderCell className="w-28 text-right py-2.5">Birim Fiyat</Table.HeaderCell>
                    <Table.HeaderCell className="w-28 text-right pr-6 py-2.5">Toplam</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {order.items?.map((item) => (
                    <Table.Row key={item.id} className="text-xs">
                      <Table.Cell className="pl-6 py-3">
                        <div className="flex items-center gap-3">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-10 h-10 object-cover rounded-md border border-ui-border-base shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center shrink-0 text-ui-fg-muted text-[10px]">
                              Resim Yok
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium text-ui-fg-base">{item.title}</span>
                            {item.subtitle && (
                              <span className="text-ui-fg-muted text-[11px]">{item.subtitle}</span>
                            )}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-center font-medium">
                        {item.quantity}
                      </Table.Cell>
                      <Table.Cell className="text-right text-ui-fg-subtle">
                        {formatPrice(item.unit_price, order.currency_code)}
                      </Table.Cell>
                      <Table.Cell className="text-right pr-6 font-semibold text-ui-fg-base">
                        {formatPrice(item.total || item.unit_price * item.quantity, order.currency_code)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Container>

          {/* Payment & Totals Summary */}
          <Container className="p-6 border border-ui-border-base rounded-xl bg-ui-bg-base">
            <div className="flex items-center gap-2 mb-4">
              <ReceiptPercent className="w-4 h-4 text-ui-fg-subtle" />
              <Heading level="h3" className="text-sm font-semibold">
                Ödeme & Tutar Özeti
              </Heading>
            </div>

            <div className="flex flex-col gap-2 text-xs border-b border-ui-border-base pb-3">
              <div className="flex justify-between text-ui-fg-subtle">
                <span>Ara Toplam</span>
                <span>{formatPrice(order.subtotal || order.total, order.currency_code)}</span>
              </div>
              {order.shipping_total !== undefined && (
                <div className="flex justify-between text-ui-fg-subtle">
                  <span>Kargo Tutarı</span>
                  <span>{formatPrice(order.shipping_total, order.currency_code)}</span>
                </div>
              )}
              {order.tax_total !== undefined && (
                <div className="flex justify-between text-ui-fg-subtle">
                  <span>Vergi</span>
                  <span>{formatPrice(order.tax_total, order.currency_code)}</span>
                </div>
              )}
              {order.discount_total ? (
                <div className="flex justify-between text-ui-fg-interactive">
                  <span>İndirim</span>
                  <span>-{formatPrice(order.discount_total, order.currency_code)}</span>
                </div>
              ) : null}
            </div>

            <div className="flex justify-between items-center pt-3 text-sm font-bold text-ui-fg-base">
              <span>Genel Toplam</span>
              <span className="text-base text-ui-fg-interactive">
                {formatPrice(order.total, order.currency_code)}
              </span>
            </div>
          </Container>
        </div>

        {/* Right Column (1 span): Cargo / Shipping & Customer Info */}
        <div className="flex flex-col gap-6">
          {/* CARGO & TRACKING CARD (Kibicarrier) */}
          <Container className="p-6 border border-ui-border-base rounded-xl bg-ui-bg-base">
            <div className="flex items-center gap-2 mb-4">
              <FlyingBox className="w-4 h-4 text-ui-fg-interactive" />
              <Heading level="h3" className="text-sm font-semibold">
                Kargo & Gönderi Bilgileri
              </Heading>
            </div>

            {trackingList.length > 0 ? (
              <div className="flex flex-col gap-3">
                {trackingList.map((trk, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle/50 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ui-fg-base">
                        {trk.carrierLabel}
                      </span>
                      <Badge size="small" color="purple" className="font-mono text-[10px]">
                        Takip No
                      </Badge>
                    </div>

                    <div className="font-mono text-xs font-semibold text-ui-fg-interactive select-all bg-ui-bg-base px-2 py-1 rounded border border-ui-border-base">
                      {trk.trackingNumber}
                    </div>

                    {trk.trackingUrl && (
                      <Button
                        size="small"
                        variant="secondary"
                        asChild
                        className="w-full mt-1 justify-center text-xs flex items-center gap-1.5"
                      >
                        <a
                          href={trk.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Kargoyu Takip Et
                          <ArrowUpRightOnBox className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-ui-border-base bg-ui-bg-subtle/30 text-center">
                <Text size="small" className="text-ui-fg-muted text-xs">
                  Henüz kargo takip numarası girilmemiş veya kargoya verilmemiş.
                </Text>
              </div>
            )}
          </Container>

          {/* Shipping Address */}
          <Container className="p-6 border border-ui-border-base rounded-xl bg-ui-bg-base">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-ui-fg-subtle" />
              <Heading level="h3" className="text-sm font-semibold">
                Teslimat Adresi
              </Heading>
            </div>

            {order.shipping_address ? (
              <div className="flex flex-col gap-1 text-xs text-ui-fg-subtle">
                <span className="font-semibold text-ui-fg-base">
                  {order.shipping_address.first_name} {order.shipping_address.last_name}
                </span>
                {order.shipping_address.phone && (
                  <span>Tel: {order.shipping_address.phone}</span>
                )}
                <span>{order.shipping_address.address_1}</span>
                {order.shipping_address.address_2 && (
                  <span>{order.shipping_address.address_2}</span>
                )}
                <span>
                  {[
                    order.shipping_address.postal_code,
                    order.shipping_address.province,
                    order.shipping_address.city,
                    order.shipping_address.country_code?.toUpperCase(),
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                </span>
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-muted text-xs">
                Teslimat adresi bulunamadı.
              </Text>
            )}
          </Container>

          {/* Customer Info */}
          <Container className="p-6 border border-ui-border-base rounded-xl bg-ui-bg-base">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-ui-fg-subtle" />
              <Heading level="h3" className="text-sm font-semibold">
                Müşteri Bilgileri
              </Heading>
            </div>

            <div className="flex flex-col gap-1 text-xs text-ui-fg-subtle">
              <span className="font-semibold text-ui-fg-base">
                {[order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") ||
                  "Kayıtsız Müşteri"}
              </span>
              <span>{order.email || "-"}</span>
              {order.customer?.phone && <span>Tel: {order.customer.phone}</span>}
            </div>
          </Container>
        </div>
      </div>

      {/* CARRIERS TRANSACTIONS TABLE */}
      <Container className="p-0 overflow-hidden border border-ui-border-base rounded-xl bg-ui-bg-base">
        <div className="px-6 py-4 border-b border-ui-border-base bg-ui-bg-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlyingBox className="w-4 h-4 text-ui-fg-interactive" />
            <Heading level="h3" className="text-sm font-semibold">
              Kargo & Taşıyıcı İşlemleri (Carrier Records)
            </Heading>
          </div>
          <Badge size="small" color="blue">
            {shipments.length} Kayıt
          </Badge>
        </div>

        <div className="overflow-x-auto bg-ui-bg-base">
          <Table>
            <Table.Header>
              <Table.Row className="bg-ui-bg-subtle/30 text-xs">
                <Table.HeaderCell className="pl-6 py-2.5">Gönderi Firması</Table.HeaderCell>
                <Table.HeaderCell className="py-2.5">Kibisis Kargo Kodu</Table.HeaderCell>
                <Table.HeaderCell className="py-2.5">Kargo Takip No</Table.HeaderCell>
                <Table.HeaderCell className="py-2.5">Kargo Barkodu</Table.HeaderCell>
                <Table.HeaderCell className="py-2.5">Açılış Tarihi</Table.HeaderCell>
                <Table.HeaderCell className="py-2.5">Son Hareket</Table.HeaderCell>
                <Table.HeaderCell className="pr-6 py-2.5 text-right">Durum</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {shipments.length === 0 ? (
                <Table.Row>
                  <td colSpan={7} className="text-center py-6 text-xs text-ui-fg-muted">
                    Bu sipariş için henüz kargo işlem kaydı bulunmamaktadır.
                  </td>
                </Table.Row>
              ) : (
                shipments.map((shp) => (
                  <Table.Row key={shp.id} className="text-xs">
                    <Table.Cell className="pl-6 py-3 font-semibold text-ui-fg-base">
                      {shp.carrier_name}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-ui-fg-interactive select-all">
                      {shp.kibisis_tracking_code}
                    </Table.Cell>
                    <Table.Cell>
                      {shp.tracking_code ? (
                        shp.tracking_url ? (
                          <a
                            href={shp.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono font-medium text-ui-fg-interactive underline decoration-dotted hover:text-ui-fg-interactive-hover"
                          >
                            {shp.tracking_code}
                            <ArrowUpRightOnBox className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="font-mono">{shp.tracking_code}</span>
                        )
                      ) : (
                        "-"
                      )}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-ui-fg-subtle select-all">
                      {shp.barcode || "-"}
                    </Table.Cell>
                    <Table.Cell className="text-ui-fg-subtle">
                      {formatDate(shp.created_at)}
                    </Table.Cell>
                    <Table.Cell className="text-ui-fg-subtle">
                      {shp.last_movement_at ? formatDate(shp.last_movement_at) : "-"}
                    </Table.Cell>
                    <Table.Cell className="pr-6 text-right">
                      <Badge size="small" color={shp.status === "delivered" ? "green" : "blue"}>
                        {shp.status === "created" ? "Kayıt Açıldı" : shp.status}
                      </Badge>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>
      </Container>
    </div>
  )
}

