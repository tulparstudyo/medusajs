import { Button, Drawer, Input, Label, Select, Switch, Text } from "@medusajs/ui"
import { FormEvent, useEffect, useMemo, useState } from "react"

import { api } from "./api"
import { NavAlign, NavItemDTO, NavMenu, TargetType } from "../types"

type CategoryOption = {
  id: string
  name: string
  handle: string
  parent_category?: { name?: string | null } | null
}

export type NavFormValues = {
  label: string
  align: NavAlign
  target_type: TargetType
  category_id: string
  url: string
  anchor: string
  new_tab: boolean
  is_active: boolean
}

type EditorState =
  | {
      mode: "create"
      menu: NavMenu
      parent_id: string | null
      parentLabel: string | null
      align: NavAlign
    }
  | { mode: "edit"; item: NavItemDTO }

const emptyValues = (align: NavAlign = "start"): NavFormValues => ({
  label: "",
  align,
  target_type: "category",
  category_id: "",
  url: "",
  anchor: "",
  new_tab: false,
  is_active: true,
})

const valuesFromItem = (item: NavItemDTO): NavFormValues => ({
  label: item.label,
  align: item.align === "end" ? "end" : "start",
  target_type: item.target_type,
  category_id: item.category_id ?? "",
  url: item.url ?? "",
  anchor: item.anchor ?? "",
  new_tab: item.new_tab,
  is_active: item.is_active,
})

export default function NavForm({
  editor,
  items,
  saving,
  onClose,
  onSubmit,
}: {
  editor: EditorState | null
  items: NavItemDTO[]
  saving: boolean
  onClose: () => void
  onSubmit: (values: NavFormValues) => Promise<void>
}) {
  const [values, setValues] = useState<NavFormValues>(emptyValues)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [categoryQuery, setCategoryQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editor) {
      return
    }

    setError(null)
    setCategoryQuery("")
    setValues(
      editor.mode === "edit" ? valuesFromItem(editor.item) : emptyValues(editor.align)
    )
  }, [editor])

  useEffect(() => {
    if (!editor || values.target_type !== "category" || categories.length) {
      return
    }

    let cancelled = false

    const load = async () => {
      const collected: CategoryOption[] = []
      let offset = 0

      while (offset < 500) {
        const page = await api<{
          product_categories: CategoryOption[]
          count: number
        }>(
          `/admin/product-categories?limit=100&offset=${offset}&fields=id,name,handle,*parent_category`
        )
        collected.push(...page.product_categories)
        offset += 100
        if (!page.product_categories.length || collected.length >= page.count) {
          break
        }
      }

      if (!cancelled) {
        setCategories(collected)
      }
    }

    load().catch((loadError: Error) => {
      if (!cancelled) {
        setError(loadError.message)
      }
    })

    return () => {
      cancelled = true
    }
  }, [editor, values.target_type, categories.length])

  const filteredCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase()
    if (!query) {
      return categories
    }

    return categories.filter((category) =>
      `${category.parent_category?.name ?? ""} ${category.name} ${category.handle}`
        .toLowerCase()
        .includes(query)
    )
  }, [categories, categoryQuery])

  const menu = editor?.mode === "edit" ? editor.item.menu : editor?.menu

  const parentLabel =
    editor?.mode === "create"
      ? editor.parentLabel
      : items.find((item) => item.id === editor?.item.parent_id)?.label ?? null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    try {
      await onSubmit(values)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Kayıt başarısız.")
    }
  }

  return (
    <Drawer open={!!editor} onOpenChange={(open) => !open && !saving && onClose()}>
      <Drawer.Content>
        <form onSubmit={submit} className="flex h-full flex-col">
          <Drawer.Header>
            <Drawer.Title>
              {editor?.mode === "edit" ? "Menü öğesini düzenle" : "Menü öğesi ekle"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-y-auto">
            <Text size="small" className="text-ui-fg-subtle">
              {parentLabel
                ? `Üst öğe: ${parentLabel}. Üst öğeyi sürükleyerek değiştirin.`
                : "Bu öğe menünün ana seviyesinde. Üst öğeyi sürükleyerek değiştirin."}
            </Text>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="kibinav-label" size="small">
                Etiket
              </Label>
              <Input
                id="kibinav-label"
                value={values.label}
                onChange={(event) =>
                  setValues((current) => ({ ...current, label: event.target.value }))
                }
                required
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small">Hedef tipi</Label>
              <Select
                value={values.target_type}
                onValueChange={(target_type: TargetType) =>
                  setValues((current) => ({ ...current, target_type }))
                }
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="category">Kategori</Select.Item>
                  <Select.Item value="url">Harici bağlantı</Select.Item>
                  <Select.Item value="anchor">Sayfa içi bağlantı</Select.Item>
                </Select.Content>
              </Select>
            </div>
            {values.target_type === "category" && (
              <div className="flex flex-col gap-y-2">
                <Label size="small">Kategori</Label>
                <Input
                  value={categoryQuery}
                  onChange={(event) => setCategoryQuery(event.target.value)}
                  placeholder="Kategori ara"
                />
                <Select
                  value={values.category_id || undefined}
                  onValueChange={(category_id) =>
                    setValues((current) => ({ ...current, category_id }))
                  }
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Kategori seçin" />
                  </Select.Trigger>
                  <Select.Content>
                    {filteredCategories.map((category) => (
                      <Select.Item key={category.id} value={category.id}>
                        {category.parent_category?.name
                          ? `${category.parent_category.name} / ${category.name}`
                          : category.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                <Text size="small" className="text-ui-fg-subtle">
                  Seçilen kategorinin liste adresine gider.
                </Text>
              </div>
            )}
            {values.target_type === "url" && (
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="kibinav-url" size="small">
                  Bağlantı
                </Label>
                <Input
                  id="kibinav-url"
                  value={values.url}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, url: event.target.value }))
                  }
                  placeholder="https://"
                  required
                />
                <div className="flex items-center justify-between gap-x-3">
                  <Label htmlFor="kibinav-new-tab" size="small">
                    Yeni sekmede aç
                  </Label>
                  <Switch
                    id="kibinav-new-tab"
                    checked={values.new_tab}
                    onCheckedChange={(new_tab) =>
                      setValues((current) => ({ ...current, new_tab }))
                    }
                  />
                </div>
              </div>
            )}
            {values.target_type === "anchor" && (
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="kibinav-anchor" size="small">
                  Sayfa içi bağlantı
                </Label>
                <Input
                  id="kibinav-anchor"
                  value={values.anchor}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, anchor: event.target.value }))
                  }
                  placeholder="/static/hakkimizda veya #hedef"
                  required
                />
                <Text size="small" className="text-ui-fg-subtle">
                  Vitrinde &quot;/...&quot; veya &quot;#hedef&quot; olarak kullanılır.
                </Text>
              </div>
            )}
            {(menu === "top" || menu === "bottom") && (
              <div className="flex flex-col gap-y-2">
                <Label size="small">Grup</Label>
                <Select
                  value={values.align}
                  onValueChange={(align: NavAlign) =>
                    setValues((current) => ({ ...current, align }))
                  }
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="start">Sol / start</Select.Item>
                    <Select.Item value="end">Sağ / end</Select.Item>
                  </Select.Content>
                </Select>
                <Text size="small" className="text-ui-fg-subtle">
                  {menu === "bottom"
                    ? "Sol grup telif yazısının yanında, sağ grup karşı tarafta görünür."
                    : "Sol grup Siparişlerim tarafında, sağ grup karşı tarafta görünür."}
                </Text>
              </div>
            )}
            <div className="flex items-center justify-between gap-x-3">
              <Label htmlFor="kibinav-active" size="small">
                Yayında
              </Label>
              <Switch
                id="kibinav-active"
                checked={values.is_active}
                onCheckedChange={(is_active) =>
                  setValues((current) => ({ ...current, is_active }))
                }
              />
            </div>
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
