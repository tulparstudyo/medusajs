import {
  initiatePaymentSession,
  retrieveCart,
  setShippingMethod,
} from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import { theme } from "@theme"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

const CheckoutForm = theme.checkout.form
const CheckoutSummary = theme.checkout.summary

export const metadata: Metadata = {
  title: "Checkout",
}

type CheckoutPageProps = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Checkout(props: CheckoutPageProps) {
  const { countryCode } = await props.params
  const searchParams = await props.searchParams
  const step = searchParams?.step as string | undefined

  let cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const hasAddress = !!(cart.shipping_address?.address_1 && cart.email)

  if (!hasAddress) {
    if (step && step !== "address") {
      redirect(`/${countryCode}/checkout?step=address`)
    }
  } else {
    const shippingMethods = await listCartShippingMethods(cart.id)
    const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")

    const hasSingleShipping = shippingMethods?.length === 1
    const hasSinglePayment = paymentMethods?.length === 1

    let shouldRefreshCart = false

    if (hasSingleShipping && shippingMethods?.[0]) {
      const isShippingSelected = cart.shipping_methods?.some(
        (sm) => sm.shipping_option_id === shippingMethods[0].id
      )
      if (!isShippingSelected) {
        await setShippingMethod({
          cartId: cart.id,
          shippingMethodId: shippingMethods[0].id,
        })
        shouldRefreshCart = true
      }
    }

    if (hasSinglePayment && paymentMethods?.[0]) {
      const activeSession = cart.payment_collection?.payment_sessions?.find(
        (s) => s.status === "pending"
      )
      if (activeSession?.provider_id !== paymentMethods[0].id) {
        await initiatePaymentSession(cart, {
          provider_id: paymentMethods[0].id,
          data: {
            cart_id: cart.id,
            email: cart.email,
            billing_address: cart.billing_address,
          },
        })
        shouldRefreshCart = true
      }
    }

    if (shouldRefreshCart) {
      const refreshedCart = await retrieveCart()
      if (refreshedCart) {
        cart = refreshedCart
      }
    }

    if (
      !step ||
      step === "delivery" ||
      (step === "payment" && hasSinglePayment)
    ) {
      if (hasSingleShipping && hasSinglePayment) {
        if (step !== "review") {
          redirect(`/${countryCode}/checkout?step=review`)
        }
      } else if (hasSingleShipping) {
        if (step !== "payment") {
          redirect(`/${countryCode}/checkout?step=payment`)
        }
      } else if (!step) {
        redirect(`/${countryCode}/checkout?step=delivery`)
      }
    }
  }

  const customer = await retrieveCustomer()

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <PaymentWrapper cart={cart}>
        <CheckoutForm cart={cart} customer={customer} />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}
