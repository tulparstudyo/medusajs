import { Button, Container, Heading, Prompt, Tabs, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import { api } from "./api"
import NavForm, { NavFormValues } from "./nav-form"
import NavTree from "./nav-tree"
import { toReorderPayload, buildTree } from "../lib/tree"
import { NavAlign, NavItemDTO, NavMenu } from "../types"

type EditorState =
  | {
      mode: "create"
      menu: NavMenu
      parent_id: string | null
      parentLabel: string | null
      align: NavAlign
    }
  | { mode: "edit"; item: NavItemDTO }
  | null

const MENUS: { id: NavMenu; label: string }[] = [
  { id: "top", label: "Üst Bar" },
  { id: "main", label: "Ana Menü" },
  { id: "footer", label: "Footer" },
  { id: "bottom", label: "Footer Alt" },
]

export default function NavPage() {
  const [menu, setMenu] = useState<NavMenu>("main")
  const [items, setItems] = useState<NavItemDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState<EditorState>(null)
  const [pendingDelete, setPendingDelete] = useState<NavItemDTO | null>(null)

  const load = useCallback(async (nextMenu: NavMenu) => {
    setLoading(true)
    try {
      const response = await api<{ items: NavItemDTO[] }>(
        `/admin/kibinav/items?menu=${nextMenu}`
      )
      setItems(response.items)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Menü yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(menu)
  }, [load, menu])

  const submit = async (values: NavFormValues) => {
    if (!editor) {
      return
    }

    setSaving(true)
    try {
      const body = formBody(values)
      if (editor.mode === "create") {
        await api("/admin/kibinav/items", {
          method: "POST",
          body: JSON.stringify({
            menu: editor.menu,
            parent_id: editor.parent_id,
            ...body,
          }),
        })
        toast.success("Menü öğesi eklendi.")
      } else {
        await api(`/admin/kibinav/items/${editor.item.id}`, {
          method: "POST",
          body: JSON.stringify(body),
        })
        toast.success("Menü öğesi güncellendi.")
      }

      setEditor(null)
      await load(menu)
    } finally {
      setSaving(false)
    }
  }

  const reorder = async (next: NavItemDTO[]) => {
    const previous = items
    setItems(next)
    setSaving(true)

    try {
      await api("/admin/kibinav/reorder", {
        method: "POST",
        body: JSON.stringify({
          menu,
          items: toReorderPayload(buildTree(next, { promoteOrphans: true })),
        }),
      })
    } catch (error) {
      setItems(previous)
      toast.error(error instanceof Error ? error.message : "Sıralama kaydedilemedi.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!pendingDelete) {
      return
    }

    setSaving(true)
    try {
      await api(`/admin/kibinav/items/${pendingDelete.id}`, { method: "DELETE" })
      toast.success("Menü öğesi silindi.")
      setPendingDelete(null)
      await load(menu)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Öğe silinemedi.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Navigasyon</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Öğeyi tutamacından sürükleyerek sıralayın. Başka bir öğenin altına almak için
            &quot;Altına bırak&quot; alanına bırakın.
          </Text>
        </div>
        <Button
          size="small"
          onClick={() =>
            setEditor({
              mode: "create",
              menu,
              parent_id: null,
              parentLabel: null,
              align: menu === "bottom" ? "end" : "start",
            })
          }
        >
          Öğe ekle
        </Button>
      </div>
      <div className="px-6 py-4">
        <Tabs value={menu} onValueChange={(value) => setMenu(value as NavMenu)}>
          <Tabs.List>
            {MENUS.map((entry) => (
              <Tabs.Trigger key={entry.id} value={entry.id}>
                {entry.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
        <div className="mt-4">
          {loading ? (
            <Text size="small" className="text-ui-fg-subtle">
              Yükleniyor...
            </Text>
          ) : items.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              Bu menüde henüz öğe yok.
            </Text>
          ) : (
            <NavTree
              items={items}
              disabled={saving}
              onReorder={reorder}
              onEdit={(item) => setEditor({ mode: "edit", item })}
              onCreateChild={(item) =>
                setEditor({
                  mode: "create",
                  menu,
                  parent_id: item.id,
                  parentLabel: item.label,
                  align: item.align === "end" ? "end" : "start",
                })
              }
              onDelete={setPendingDelete}
            />
          )}
        </div>
      </div>
      <NavForm
        editor={editor}
        items={items}
        saving={saving}
        onClose={() => setEditor(null)}
        onSubmit={submit}
      />
      <Prompt
        open={!!pendingDelete}
        variant="danger"
        onOpenChange={(open) => !open && !saving && setPendingDelete(null)}
      >
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Menü öğesini sil</Prompt.Title>
            <Prompt.Description>
              {pendingDelete
                ? `"${pendingDelete.label}" kalıcı olarak silinecek.`
                : "Bu öğe silinecek."}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel disabled={saving}>Vazgeç</Prompt.Cancel>
            <Prompt.Action onClick={() => void remove()} disabled={saving}>
              Sil
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}

function formBody(values: NavFormValues) {
  const shared = {
    label: values.label,
    align: values.align,
    is_active: values.is_active,
    new_tab: values.target_type === "url" ? values.new_tab : false,
    target_type: values.target_type,
  }

  if (values.target_type === "category") {
    return { ...shared, category_id: values.category_id }
  }

  if (values.target_type === "url") {
    return { ...shared, url: values.url }
  }

  return { ...shared, anchor: values.anchor }
}
