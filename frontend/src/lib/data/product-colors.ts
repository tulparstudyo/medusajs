import "server-only"

import { sdk } from "@lib/config"

export type ProductColor = {
  product_id: string
  handle: string
  title: string
  color: string
  color_hex: string | null
  thumbnail: string | null
  in_stock: boolean
}

export const getProductColors = async (productId: string): Promise<ProductColor[]> => {
  try {
    const { items } = await sdk.client.fetch<{
      main_code: string | null
      items: ProductColor[]
    }>(`/store/kibigroup/${productId}`, { cache: "no-store" })

    return items ?? []
  } catch {
    return []
  }
}
