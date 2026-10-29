import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getPageSections, isStorePageKey } from "@modules/kibipage"
import { theme } from "@theme"

const StaticPage = theme.staticPage

type Props = {
  params: Promise<{ countryCode: string; key: string }>
}

function isStaticRouteKey(key: string): boolean {
  return isStorePageKey(key) && key !== "home" && key !== "product"
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { key } = await props.params
  if (!isStaticRouteKey(key)) {
    return { title: "Sayfa bulunamadı" }
  }

  const page = await getPageSections(key)
  if (!page.exists) {
    return { title: "Sayfa bulunamadı" }
  }

  return {
    title: page.label,
    description: page.label,
  }
}

export default async function Page(props: Props) {
  const { countryCode, key } = await props.params

  if (!isStaticRouteKey(key)) {
    notFound()
  }

  return <StaticPage pageKey={key} countryCode={countryCode} />
}
