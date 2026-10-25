import { Button, Drawer, Input, Label, Select, Switch, Text } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"

import QuickCategoriesForm, {
  QuickCategoriesSettings,
  readQuickCategories,
} from "./sections/quick-categories-form"
import HeroShowcaseForm, {
  HeroShowcaseSettings,
  readHeroShowcase,
} from "./sections/hero-showcase-form"
import SelectedProductForm, {
  readSelectedProduct,
} from "./sections/selected-product-form"
import PromoBannerForm, {
  PromoBannerSettings,
  readPromoBanner,
} from "./sections/promo-banner-form"
import FastLinksForm, {
  FastLinksSettings,
  readFastLinks,
} from "./sections/fast-links-form"
import IconBoxForm, { IconBoxSettings, readIconBox } from "./sections/icon-box-form"
import {
  isBannerSection,
  isFastLinksSection,
  isIconBoxSection,
  isProductSection,
  PageKey,
  PRODUCT_PLACEMENT_LABELS,
  PRODUCT_PLACEMENTS,
  ProductPlacement,
  readInstallments,
  readPlacement,
  SECTION_LABELS,
  SectionDTO,
  SelectedProductSettings,
} from "../types"

export type SectionFormValues = {
  name: string
  is_active: boolean
  settings: (
    | QuickCategoriesSettings
    | HeroShowcaseSettings
    | SelectedProductSettings
    | PromoBannerSettings
    | FastLinksSettings
    | IconBoxSettings
    | Record<string, unknown>
  ) & {
    placement?: ProductPlacement
    installments?: number
  }
}

export default function SectionForm({
  section,
  pageKey,
  saving,
  onClose,
  onSubmit,
}: {
  section: SectionDTO | null
  pageKey: PageKey | null
  saving: boolean
  onClose: () => void
  onSubmit: (values: SectionFormValues) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [items, setItems] = useState<QuickCategoriesSettings>({ items: [] })
  const [hero, setHero] = useState<HeroShowcaseSettings>(readHeroShowcase(null))
  const [products, setProducts] = useState<SelectedProductSettings>(
    readSelectedProduct(null)
  )
  const [banner, setBanner] = useState<PromoBannerSettings>(readPromoBanner(null))
  const [links, setLinks] = useState<FastLinksSettings>(readFastLinks(null))
  const [boxes, setBoxes] = useState<IconBoxSettings>(readIconBox(null))
  const [placement, setPlacement] = useState<ProductPlacement>("below")
  const [installments, setInstallments] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const isQuick = section?.type === "quick-categories"
  const isHero = section?.type === "hero-showcase"
  const isProducts = section ? isProductSection(section.type) : false
  const isBanner = section ? isBannerSection(section.type) : false
  const isLinks = section ? isFastLinksSection(section.type) : false
  const isBoxes = section ? isIconBoxSection(section.type) : false
  const typeLabel =
    section && section.type in SECTION_LABELS
      ? SECTION_LABELS[section.type as keyof typeof SECTION_LABELS]
      : section?.type

  useEffect(() => {
    if (!section) {
      return
    }

    setName(section.name)
    setIsActive(section.is_active)
    setItems(readQuickCategories(section.settings))
    setHero(readHeroShowcase(section.settings))
    setProducts(readSelectedProduct(section.settings))
    setBanner(readPromoBanner(section.settings))
    setLinks(readFastLinks(section.settings))
    setBoxes(readIconBox(section.settings))
    setPlacement(readPlacement(section.settings, section.type))
    setInstallments(readInstallments(section.settings))
    setError(null)
  }, [section])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!section) {
      return
    }

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Bölüm adı gerekli.")
      return
    }

    setError(null)
    const content = isQuick
      ? items
      : isHero
        ? hero
        : isProducts
          ? products
          : isBanner
            ? banner
            : isLinks
              ? links
              : isBoxes
                ? boxes
                : {}
    const settings =
      pageKey === "product"
        ? {
            ...content,
            placement,
            ...(placement === "buy" && installments >= 2 ? { installments } : {}),
          }
        : content
    try {
      await onSubmit({
        name: trimmed,
        is_active: isActive,
        settings,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Bölüm kaydedilemedi.")
    }
  }

  return (
    <Drawer open={!!section} onOpenChange={(open) => !open && !saving && onClose()}>
      <Drawer.Content>
        <form onSubmit={(event) => void submit(event)} className="flex h-full flex-col">
          <Drawer.Header>
            <Drawer.Title>{typeLabel ?? "Bölüm"}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="kibipage-name" size="small">
                Bölüm adı
              </Label>
              <Input
                id="kibipage-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Text size="small" className="text-ui-fg-subtle">
                Listede bu bölümü ayırt etmek için kullanılır.
              </Text>
            </div>
            <div className="flex items-center justify-between gap-x-3">
              <Label htmlFor="kibipage-active" size="small">
                Yayında
              </Label>
              <Switch
                id="kibipage-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
            {pageKey === "product" ? (
              <div className="flex flex-col gap-y-2">
                <Label size="small">Konum</Label>
                <Select
                  value={placement}
                  onValueChange={(value: ProductPlacement) => setPlacement(value)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {PRODUCT_PLACEMENTS.map((value) => (
                      <Select.Item key={value} value={value}>
                        {PRODUCT_PLACEMENT_LABELS[value]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                <Text size="small" className="text-ui-fg-subtle">
                  Satın alma, sepete ekle düğmesinin altıdır. Sağ sütun fiyatın yanındaki
                  kutudur. Açıklamanın altı tam genişliktedir.
                </Text>
              </div>
            ) : null}
            {pageKey === "product" && placement === "buy" ? (
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="kibipage-installments" size="small">
                  Taksit sayısı
                </Label>
                <Input
                  id="kibipage-installments"
                  type="number"
                  min={2}
                  max={36}
                  value={installments >= 2 ? String(installments) : ""}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    setInstallments(
                      Number.isInteger(next) && next >= 2 && next <= 36 ? next : 0
                    )
                  }}
                />
                <Text size="small" className="text-ui-fg-subtle">
                  2 veya daha büyükse fiyat kutusunda taksit satırı çıkar. Tutar, seçili
                  varyant fiyatının bu sayıya bölünmüş halidir. Boş bırakılırsa satır gizlenir.
                </Text>
              </div>
            ) : null}
            {isQuick && section ? (
              <QuickCategoriesForm key={section.id} value={items} onChange={setItems} />
            ) : null}
            {isHero && section ? (
              <HeroShowcaseForm key={section.id} value={hero} onChange={setHero} />
            ) : null}
            {isProducts && section ? (
              <SelectedProductForm
                key={section.id}
                value={products}
                onChange={setProducts}
              />
            ) : null}
            {isBanner && section ? (
              <PromoBannerForm key={section.id} value={banner} onChange={setBanner} />
            ) : null}
            {isLinks && section ? (
              <FastLinksForm key={section.id} value={links} onChange={setLinks} />
            ) : null}
            {isBoxes && section ? (
              <IconBoxForm key={section.id} value={boxes} onChange={setBoxes} />
            ) : null}
            {section && !isQuick && !isHero && !isProducts && !isBanner && !isLinks && !isBoxes ? (
              <Text size="small" className="text-ui-fg-subtle">
                Bu bölümün içerik formu henüz yok. Vitrinde mevcut tasarım gösterilir.
              </Text>
            ) : null}
            {error && (
              <Text size="small" className="text-ui-fg-error">
                {error}
              </Text>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button type="button" variant="secondary" disabled={saving}>
                Vazgeç
              </Button>
            </Drawer.Close>
            <Button type="submit" isLoading={saving}>
              Kaydet
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
