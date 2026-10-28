import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge, Button, Text } from "@medusajs/ui"

import {
  BANNER_LAYOUT_LABELS,
  BANNER_LAYOUTS,
  BannerLayout,
  FAST_LINK_VARIANT_LABELS,
  FAST_LINK_VARIANTS,
  FastLinkVariant,
  isBannerSection,
  isFastLinksSection,
  isHtmlContentSection,
  isIconBoxSection,
  isProductSection,
  PRODUCT_SOURCE_LABELS,
  PRODUCT_SOURCES,
  ProductSource,
  PRODUCT_PLACEMENT_LABELS,
  readPlacement,
  SECTION_LABELS,
  SectionDTO,
} from "../types"

function moveSection(sections: SectionDTO[], from: number, to: number) {
  const next = sections.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next.map((section, position) => ({ ...section, position }))
}

function summary(section: SectionDTO) {
  const label =
    section.type in SECTION_LABELS
      ? SECTION_LABELS[section.type as keyof typeof SECTION_LABELS]
      : section.type

  if (section.type === "quick-categories") {
    const items = section.settings.items
    const count = Array.isArray(items) ? items.length : 0
    return `${label} · ${count} öğe`
  }

  if (section.type === "hero-showcase") {
    const slides = section.settings.slides
    const count = Array.isArray(slides) ? slides.length : 0
    return `${label} · ${count} slayt`
  }

  if (isBannerSection(section.type)) {
    const layout = section.settings.layout
    const layoutLabel =
      typeof layout === "string" && (BANNER_LAYOUTS as readonly string[]).includes(layout)
        ? BANNER_LAYOUT_LABELS[layout as BannerLayout]
        : BANNER_LAYOUT_LABELS.grid
    const items = section.settings.items
    const count = Array.isArray(items) ? items.length : 0
    return `${label} · ${layoutLabel} · ${count} öğe`
  }

  if (isFastLinksSection(section.type)) {
    const variant = section.settings.variant
    const variantLabel =
      typeof variant === "string" && (FAST_LINK_VARIANTS as readonly string[]).includes(variant)
        ? FAST_LINK_VARIANT_LABELS[variant as FastLinkVariant]
        : FAST_LINK_VARIANT_LABELS.outline
    const items = section.settings.items
    const count = Array.isArray(items) ? items.length : 0
    return `${label} · ${variantLabel} · ${count} öğe`
  }

  if (isIconBoxSection(section.type)) {
    const items = section.settings.items
    const count = Array.isArray(items) ? items.length : 0
    return `${label} · ${count} kutu`
  }

  if (isHtmlContentSection(section.type)) {
    const html = typeof section.settings.html === "string" ? section.settings.html.trim() : ""
    return html ? `${label} · dolu` : `${label} · boş`
  }

  if (isProductSection(section.type)) {
    const source = section.settings.source
    const sourceLabel =
      typeof source === "string" &&
      (PRODUCT_SOURCES as readonly string[]).includes(source)
        ? PRODUCT_SOURCE_LABELS[source as ProductSource]
        : PRODUCT_SOURCE_LABELS.new
    const limit = typeof section.settings.limit === "number" ? section.settings.limit : 8
    return `${label} · ${sourceLabel} · ${limit} ürün`
  }

  return label
}

export default function SectionList({
  sections,
  pageKey,
  disabled,
  onReorder,
  onEdit,
  onDelete,
}: {
  sections: SectionDTO[]
  pageKey: string
  disabled: boolean
  onReorder: (sections: SectionDTO[]) => void
  onEdit: (section: SectionDTO) => void
  onDelete: (section: SectionDTO) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const from = sections.findIndex((section) => section.id === active.id)
    const to = sections.findIndex((section) => section.id === over.id)
    if (from < 0 || to < 0) {
      return
    }

    onReorder(moveSection(sections, from, to))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
        <div className={disabled ? "pointer-events-none flex flex-col gap-y-2 opacity-60" : "flex flex-col gap-y-2"}>
          {sections.map((section) => (
            <SectionRow
              key={section.id}
              section={section}
              pageKey={pageKey}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SectionRow({
  section,
  pageKey,
  onEdit,
  onDelete,
}: {
  section: SectionDTO
  pageKey: string
  onEdit: (section: SectionDTO) => void
  onDelete: (section: SectionDTO) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-x-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-ui-fg-muted"
        aria-label="Taşı"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">
        <Text weight="plus" className="truncate">
          {section.name || summary(section)}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {pageKey === "product"
            ? `${summary(section)} · ${PRODUCT_PLACEMENT_LABELS[readPlacement(section.settings, section.type)]}`
            : summary(section)}
        </Text>
      </div>
      <Badge color={section.is_active ? "green" : "grey"} size="2xsmall">
        {section.is_active ? "Yayında" : "Gizli"}
      </Badge>
      <Button type="button" size="small" variant="secondary" onClick={() => onEdit(section)}>
        Düzenle
      </Button>
      <Button type="button" size="small" variant="danger" onClick={() => onDelete(section)}>
        Sil
      </Button>
    </div>
  )
}
