import React, { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Button, Container, Text } from "@medusajs/ui"
import { ArrowRightOnRectangle, ShoppingCart } from "@medusajs/icons"

export default function OrdersRedirectWidget() {
  const navigate = useNavigate()
  const location = useLocation()

  const isDefaultExplicit = location.search.includes("default=true")

  useEffect(() => {
    // Hide the duplicate default Orders link from sidebar
    const styleId = "kibisis-hide-default-orders-nav"
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style")
      style.id = styleId
      style.innerHTML = `
        [data-section-entry-id="nav:/orders"],
        a[href="/orders"]:not([data-kibisis="true"]) {
          display: none !important;
        }
      `
      document.head.appendChild(style)
    }

    // Auto-redirect to Kibisis Orders if not explicitly requesting default view
    if (!isDefaultExplicit) {
      navigate("/kibisis/orders", { replace: true })
    }
  }, [isDefaultExplicit, navigate])

  if (!isDefaultExplicit) {
    return null
  }

  return (
    <Container className="mb-4 p-3 bg-ui-bg-subtle border border-ui-border-base rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-ui-fg-subtle" />
        <Text size="small" className="text-ui-fg-subtle">
          Şu an <strong>standart Medusa sipariş ekranındasınız</strong> (?default=true).
        </Text>
      </div>

      <Button
        size="small"
        variant="secondary"
        onClick={() => navigate("/kibisis/orders")}
        className="flex items-center gap-1.5"
      >
        Kibisis Özel Sipariş Ekranına Git
        <ArrowRightOnRectangle className="w-3.5 h-3.5" />
      </Button>
    </Container>
  )
}

