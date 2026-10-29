import { Button, Drawer, Input, Label, Text } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"

import { isPageKey, PageDTO, slugifyPageKey } from "../types"

export type PageEditorState =
  | { mode: "create" }
  | { mode: "edit"; page: PageDTO }

export type PageFormValues = {
  label: string
  page_key: string
}

export default function PageForm({
  editor,
  saving,
  onClose,
  onSubmit,
}: {
  editor: PageEditorState | null
  saving: boolean
  onClose: () => void
  onSubmit: (values: PageFormValues) => Promise<void>
}) {
  const [label, setLabel] = useState("")
  const [pageKey, setPageKey] = useState("")
  const [keyTouched, setKeyTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = editor?.mode === "edit"
  const isSystem = isEdit ? editor.page.is_system : false

  useEffect(() => {
    if (!editor) {
      return
    }

    setError(null)
    if (editor.mode === "edit") {
      setLabel(editor.page.label)
      setPageKey(editor.page.key)
      setKeyTouched(true)
    } else {
      setLabel("")
      setPageKey("")
      setKeyTouched(false)
    }
  }, [editor])

  const onLabelChange = (nextLabel: string) => {
    setLabel(nextLabel)
    if (!keyTouched && !isSystem) {
      setPageKey(slugifyPageKey(nextLabel))
    }
  }

  const onKeyChange = (nextKey: string) => {
    setKeyTouched(true)
    setPageKey(nextKey.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedLabel = label.trim()
    const normalizedKey = isSystem
      ? editor?.mode === "edit"
        ? editor.page.key
        : pageKey.trim()
      : slugifyPageKey(pageKey)

    if (!trimmedLabel) {
      setError("Sayfa adı gerekli.")
      return
    }

    if (!isPageKey(normalizedKey)) {
      setError(
        "Sayfa anahtarı yalnızca küçük harf, rakam ve tire içerebilir."
      )
      return
    }

    setError(null)
    try {
      await onSubmit({
        label: trimmedLabel,
        page_key: normalizedKey,
      })
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Sayfa kaydedilemedi."
      )
    }
  }

  const previewPath =
    pageKey === "home"
      ? "/"
      : pageKey === "product"
        ? "/products/*"
        : `/static/${slugifyPageKey(pageKey) || "..."}`

  return (
    <Drawer open={!!editor} onOpenChange={(open) => !open && !saving && onClose()}>
      <Drawer.Content>
        <form onSubmit={(event) => void submit(event)} className="flex h-full flex-col">
          <Drawer.Header>
            <Drawer.Title>
              {isEdit ? "Sayfayı düzenle" : "Yeni sayfa ekle"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="kibipage-page-label" size="small">
                Sayfa adı
              </Label>
              <Input
                id="kibipage-page-label"
                value={label}
                onChange={(event) => onLabelChange(event.target.value)}
                placeholder="Örn: Kargo ve Teslimat"
                required
              />
              <Text size="small" className="text-ui-fg-subtle">
                Yönetim panelinde ve mağaza sayfası başlığında gösterilir.
              </Text>
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="kibipage-page-key" size="small">
                Sayfa anahtarı (URL)
              </Label>
              <Input
                id="kibipage-page-key"
                value={pageKey}
                onChange={(event) => onKeyChange(event.target.value)}
                placeholder="kargo-ve-teslimat"
                disabled={isSystem}
                required
              />
              <Text size="small" className="text-ui-fg-subtle">
                {isSystem
                  ? `Sistem sayfası anahtarı sabittir (${previewPath}).`
                  : `Mağaza adresi: ${previewPath}`}
              </Text>
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

