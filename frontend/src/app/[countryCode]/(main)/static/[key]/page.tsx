import { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  isStorePageKey,
  STORE_PAGE_LABELS,
  StorePageKey,
} from "@lib/data/pages"
import { theme } from "@theme"

const StaticPage = theme.staticPage

type Props = {
  params: Promise<{ countryCode: string; key: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { key } = await props.params
  if (!isStorePageKey(key)) {
    return { title: "Sayfa bulunamadı" }
  }

  const title = STORE_PAGE_LABELS[key as StorePageKey]
  return {
    title,
    description: title,
  }
}

export default async function Page(props: Props) {
  const { countryCode, key } = await props.params

  if (!isStorePageKey(key)) {
    notFound()
  }

  return <StaticPage pageKey={key} countryCode={countryCode} />
}
