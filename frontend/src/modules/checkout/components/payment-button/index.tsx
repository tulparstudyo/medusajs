"use client"

import { isKibipayment, isManual, isStripeLike } from "@lib/constants"
import { initiatePaymentSession, placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useParams } from "next/navigation"
import React, { useEffect, useState } from "react"
import ErrorMessage from "../error-message"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
  disabled?: boolean
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
  disabled: externalDisabled = false,
}) => {
  const notReady =
    externalDisabled ||
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession =
    cart.payment_collection?.payment_sessions?.find((s) => s.status === "pending") ??
    cart.payment_collection?.payment_sessions?.[0]

  switch (true) {
    case isKibipayment(paymentSession?.provider_id):
      return (
        <KibipaymentButton
          cart={cart}
          notReady={notReady}
          data-testid={dataTestId}
        />
      )
    case isStripeLike(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    default:
      return <Button disabled>Select a payment method</Button>
  }
}

const KibipaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Tarayıcı geri düğmesiyle iyzico ödeme sayfasından geri dönüldüğünde (BFCache)
  // düğmenin loading veya takılı kalmasını önlemek için submitting durumunu sıfırla
  useEffect(() => {
    const handlePageShow = () => {
      setSubmitting(false)
    }
    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [])
  const session =
    cart.payment_collection?.payment_sessions?.find(
      (s) => isKibipayment(s.provider_id) && s.status === "pending"
    ) ??
    cart.payment_collection?.payment_sessions?.find(
      (s) => isKibipayment(s.provider_id)
    )
  const presentation = (session?.data as Record<string, unknown>)?.presentation as
    | Record<string, unknown>
    | undefined

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    const providerId = session?.provider_id || "kibipayment"

    try {
      // Ödeme sayfasına gitmeden hemen önce seans ve token'ı her tıklamada taze olarak başlatıyoruz.
      // Böylece kullanıcı sipariş özetinde uzun süre beklese veya sayfayı yenilese bile
      // iyzico token'ının süresi dolmaz ve "Geçersiz token" hatası oluşmaz.
      const res = await initiatePaymentSession(cart, {
        provider_id: providerId,
        data: {
          cart_id: cart.id,
          email: cart.email,
          billing_address: cart.billing_address,
          storefront_url: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      })

      if (!res.ok) {
        setErrorMessage(res.message || "Ödeme oturumu başlatılamadı.")
        setSubmitting(false)
        return
      }

      const redirectUrl = res.redirectUrl || presentation?.redirectUrl
      if (redirectUrl) {
        window.location.href = String(redirectUrl)
        return
      }

      const paymentPageUrl = res.paymentPageUrl || presentation?.paymentPageUrl
      if (paymentPageUrl) {
        window.location.href = String(paymentPageUrl)
        return
      }

      await onPaymentCompleted()
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Ödeme başlatılırken bir hata oluştu."
      )
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid={dataTestId}
      >
        {isKibipayment(session?.provider_id) || presentation?.redirectUrl || presentation?.paymentPageUrl
          ? "Güvenli Ödeme Sayfasına Git"
          : "Siparişi Tamamla"}
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="kibipayment-error-message"
      />
    </>
  )
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const stripe = useStripe()
  const elements = useElements()
  const { countryCode } = useParams()

  const disabled = !stripe || !elements ? true : false

  const handlePayment = async () => {
    if (!stripe || !elements || !cart) {
      return
    }

    setSubmitting(true)

    await stripe
      .confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/api/payment-return?cart_id=${cart.id}&country_code=${countryCode}`,
          payment_method_data: {
            billing_details: {
              name:
                cart.billing_address?.first_name +
                " " +
                cart.billing_address?.last_name,
              address: {
                city: cart.billing_address?.city ?? undefined,
                country: cart.billing_address?.country_code ?? undefined,
                line1: cart.billing_address?.address_1 ?? undefined,
                line2: cart.billing_address?.address_2 ?? undefined,
                postal_code: cart.billing_address?.postal_code ?? undefined,
                state: cart.billing_address?.province ?? undefined,
              },
              email: cart.email,
              phone: cart.billing_address?.phone ?? undefined,
            },
          },
        },
        redirect: "if_required",
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
            return
          }

          setErrorMessage(error.message || null)
          setSubmitting(false)
          return
        }

        if (
          paymentIntent.status === "requires_capture" ||
          paymentIntent.status === "succeeded"
        ) {
          onPaymentCompleted()
          return
        }

        setSubmitting(false)
      })
  }

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
