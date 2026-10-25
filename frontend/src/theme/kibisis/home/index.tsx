import { getPageSections } from "@lib/data/pages"

import SectionSlot from "./section-slot"

export default async function KibisisHome({
  countryCode,
}: {
  countryCode: string
}) {
  const page = await getPageSections("home")

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-8">
      {page.sections.map((section) => (
        <SectionSlot
          key={section.id}
          section={section}
          countryCode={countryCode}
        />
      ))}
    </div>
  )
}
