import { notFound } from "next/navigation"

import { getPageSections, StorePageKey } from "./pages"
import SectionSlot from "./section-slot"

export default async function KibisisStaticPage({
  pageKey,
  countryCode,
}: {
  pageKey: StorePageKey
  countryCode: string
}) {
  const page = await getPageSections(pageKey)
  if (!page.exists) {
    notFound()
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {page.sections.length > 0 ? (
        page.sections.map((section) => (
          <SectionSlot
            key={section.id}
            section={section}
            countryCode={countryCode}
          />
        ))
      ) : (
        <p className="text-sm text-slate-500">Bu sayfada henüz içerik yok.</p>
      )}
    </main>
  )
}

