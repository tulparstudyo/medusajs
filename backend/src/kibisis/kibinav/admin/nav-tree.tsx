import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  pointerWithin,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge, Button, Text } from "@medusajs/ui"
import { useState } from "react"

import {
  buildTree,
  findNode,
  moveFlatItem,
  type TreeNode,
} from "../lib/tree"
import { NavItemDTO, TargetType } from "../types"

const TARGET_LABELS: Record<TargetType, string> = {
  category: "Kategori",
  url: "Bağlantı",
  anchor: "Sayfa içi",
}

const CHILD_DELETE_HINT =
  "Bu öğenin alt öğeleri var. Önce alt öğeleri silin veya taşıyın."

const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  return pointerHits.length ? pointerHits : closestCenter(args)
}

export default function NavTree({
  items,
  disabled,
  onReorder,
  onEdit,
  onCreateChild,
  onDelete,
}: {
  items: NavItemDTO[]
  disabled: boolean
  onReorder: (items: NavItemDTO[]) => void
  onEdit: (item: NavItemDTO) => void
  onCreateChild: (item: NavItemDTO) => void
  onDelete: (item: NavItemDTO) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const tree = buildTree(items, { promoteOrphans: true })

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const data = over.data.current as
      | { type?: string; parentId?: string | null; sortable?: { containerId: string; index: number } }
      | undefined

    let parentId: string | null
    let index: number

    if (data?.type === "nest") {
      parentId = data.parentId ?? null
      const siblings = parentId ? findNode(tree, parentId)?.children ?? [] : tree
      index = siblings.length
    } else if (data?.sortable) {
      parentId = data.sortable.containerId === "root" ? null : data.sortable.containerId
      index = data.sortable.index
    } else {
      return
    }

    const next = moveFlatItem(items, String(active.id), parentId, index)
    if (!next) {
      return
    }

    const changed = next.some((item, itemIndex) => {
      const previous = items[itemIndex]
      return (
        !previous ||
        previous.id !== item.id ||
        previous.parent_id !== item.parent_id ||
        previous.position !== item.position
      )
    })

    if (changed) {
      onReorder(next)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      <div className={disabled ? "pointer-events-none opacity-60" : undefined}>
        {activeId && <NestZone parentId={null} />}
        <Branch
          nodes={tree}
          parentId={null}
          items={items}
          activeId={activeId}
          onEdit={onEdit}
          onCreateChild={onCreateChild}
          onDelete={onDelete}
        />
      </div>
    </DndContext>
  )
}

function Branch({
  nodes,
  parentId,
  items,
  activeId,
  onEdit,
  onCreateChild,
  onDelete,
}: {
  nodes: TreeNode<NavItemDTO>[]
  parentId: string | null
  items: NavItemDTO[]
  activeId: string | null
  onEdit: (item: NavItemDTO) => void
  onCreateChild: (item: NavItemDTO) => void
  onDelete: (item: NavItemDTO) => void
}) {
  return (
    <SortableContext
      id={parentId ?? "root"}
      items={nodes.map((node) => node.id)}
      strategy={verticalListSortingStrategy}
    >
      <div className={parentId ? "ml-6 flex flex-col gap-y-2" : "flex flex-col gap-y-2"}>
        {nodes.map((node) => (
          <Row
            key={node.id}
            node={node}
            parentId={parentId}
            items={items}
            activeId={activeId}
            onEdit={onEdit}
            onCreateChild={onCreateChild}
            onDelete={onDelete}
          />
        ))}
      </div>
    </SortableContext>
  )
}

function Row({
  node,
  parentId,
  items,
  activeId,
  onEdit,
  onCreateChild,
  onDelete,
}: {
  node: TreeNode<NavItemDTO>
  parentId: string | null
  items: NavItemDTO[]
  activeId: string | null
  onEdit: (item: NavItemDTO) => void
  onCreateChild: (item: NavItemDTO) => void
  onDelete: (item: NavItemDTO) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: node.id,
      data: { type: "item", parentId },
    })
  const hasChildren = items.some((item) => item.parent_id === node.id)
  const collapsed = activeId === node.id

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-60" : undefined}
    >
      <div className="flex items-center gap-x-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2">
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
            {node.label}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            {TARGET_LABELS[node.target_type]}
            {node.target_type === "anchor" && node.anchor ? ` · ${node.anchor}` : ""}
            {node.target_type === "url" && node.url ? ` · ${node.url}` : ""}
          </Text>
        </div>
        {(node.menu === "top" || node.menu === "bottom") && (
          <Badge size="2xsmall">{node.align === "end" ? "Sağ" : "Sol"}</Badge>
        )}
        <Badge color={node.is_active ? "green" : "grey"} size="2xsmall">
          {node.is_active ? "Yayında" : "Gizli"}
        </Badge>
        <Button type="button" size="small" variant="secondary" onClick={() => onCreateChild(node)}>
          Alt öğe
        </Button>
        <Button type="button" size="small" variant="secondary" onClick={() => onEdit(node)}>
          Düzenle
        </Button>
        <Button
          type="button"
          size="small"
          variant="danger"
          disabled={hasChildren}
          title={hasChildren ? CHILD_DELETE_HINT : "Sil"}
          onClick={() => onDelete(node)}
        >
          Sil
        </Button>
      </div>
      {!collapsed && <NestZone parentId={node.id} />}
      {!collapsed && (
        <Branch
          nodes={node.children}
          parentId={node.id}
          items={items}
          activeId={activeId}
          onEdit={onEdit}
          onCreateChild={onCreateChild}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

function NestZone({ parentId }: { parentId: string | null }) {
  const { active } = useDndContext()
  const { setNodeRef, isOver } = useDroppable({
    id: parentId ? `nest:${parentId}` : "nest:root",
    data: { type: "nest", parentId },
    disabled: !active || active.id === parentId,
  })

  if (!active || active.id === parentId) {
    return null
  }

  return (
    <div
      ref={setNodeRef}
      className={`my-1 rounded-md border border-dashed px-3 py-1 text-xs ${
        isOver
          ? "border-ui-border-interactive bg-ui-bg-highlight text-ui-fg-base"
          : "border-ui-border-base text-ui-fg-muted"
      }`}
    >
      {parentId ? "Altına bırak" : "Ana seviyeye bırak"}
    </div>
  )
}
