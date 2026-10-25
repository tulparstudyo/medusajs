import { retrieveOrder } from "@lib/data/orders"
import { theme } from "@theme"
import { Metadata } from "next"
import { notFound } from "next/navigation"

const OrderCompletedTemplate = theme.order.completed

type Props = {
  params: Promise<{ id: string }>
}
export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "You purchase was successful",
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    return notFound()
  }

  return <OrderCompletedTemplate order={order} />
}
