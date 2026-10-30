import { retrieveOrder } from "@lib/data/orders"
import { getCacheTag, removeCartId } from "@lib/data/cookies"
import { revalidateTag } from "next/cache"
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

  // Ödeme sağlayıcısından dönüldüğünde tamamlanan sepeti temizle ve önbellekleri tazele
  await removeCartId()

  const orderCacheTag = await getCacheTag("orders")
  if (orderCacheTag) {
    revalidateTag(orderCacheTag, { expire: 0 })
  }
  const cartCacheTag = await getCacheTag("carts")
  if (cartCacheTag) {
    revalidateTag(cartCacheTag, { expire: 0 })
  }
  const customerCacheTag = await getCacheTag("customers")
  if (customerCacheTag) {
    revalidateTag(customerCacheTag, { expire: 0 })
  }

  return <OrderCompletedTemplate order={order} />
}
