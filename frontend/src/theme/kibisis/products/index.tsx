import { HttpTypes } from "@medusajs/types"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { getPageSections } from "@lib/data/pages"
import { getProductColors } from "@lib/data/product-colors"
import SectionSlot from "../home/section-slot"
import { ProductBreadcrumbs, ProductDetails } from "./info"
import ProductOverview from "./overview"
import { sectionInstallments, sectionPlacement } from "./placement"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

export default async function KibisisProductTemplate({
  product,
  countryCode,
}: ProductTemplateProps) {
  if (!product?.id) {
    notFound()
  }

  const [page, colors] = await Promise.all([
    getPageSections("product"),
    getProductColors(product.id),
  ])
  const buy = page.sections.filter((section) => sectionPlacement(section) === "buy")
  const aside = page.sections.filter((section) => sectionPlacement(section) === "aside")
  const below = page.sections.filter((section) => sectionPlacement(section) === "below")
  const installments = buy.reduce(
    (count, section) => count || sectionInstallments(section),
    0
  )

  return (
    <>
      <ProductBreadcrumbs product={product} />
      <Suspense fallback={<ProductOverviewFallback product={product} />}>
        <ProductOverview
          product={product}
          colors={colors}
          installments={installments}
          buy={
            buy.length
              ? buy.map((section) => (
                  <Suspense key={section.id} fallback={null}>
                    <SectionSlot section={section} countryCode={countryCode} />
                  </Suspense>
                ))
              : null
          }
          aside={
            aside.length
              ? aside.map((section) => (
                  <Suspense key={section.id} fallback={null}>
                    <SectionSlot section={section} countryCode={countryCode} />
                  </Suspense>
                ))
              : null
          }
        />
      </Suspense>
      <ProductDetails product={product} />
      {below.length ? (
        <div className="max-w-7xl mx-auto px-4 pb-8 space-y-8">
          {below.map((section) => (
            <Suspense key={section.id} fallback={null}>
              <SectionSlot section={section} countryCode={countryCode} />
            </Suspense>
          ))}
        </div>
      ) : null}
    </>
  )
}

function ProductOverviewFallback({ product }: { product: HttpTypes.StoreProduct }) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-xl sm:text-2xl font-black text-slate-900">{product.title}</h1>
    </section>
  )
}
