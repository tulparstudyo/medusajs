import { getLocale } from "@lib/data/locale-actions"
import { DEFAULT_LOCALE } from "@lib/util/default-locale"
import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const lang = (await getLocale()) || DEFAULT_LOCALE

  return (
    <html lang={lang} data-mode="light">
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
