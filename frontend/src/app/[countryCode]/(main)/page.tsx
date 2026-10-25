import { Metadata } from "next"

import { theme } from "@theme"

const Home = theme.home

export const metadata: Metadata = {
  title: "Medusa Next.js Starter Template",
  description:
    "A performant frontend ecommerce starter template with Next.js 16 and Medusa.",
}

export default async function Page(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  return <Home countryCode={countryCode} />
}
