import {
  Badge,
  Button,
  Container,
  Heading,
  Prompt,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import { api } from "./api"
import PageForm, { PageEditorState, PageFormValues } from "./page-form"
import PageTranslate from "./page-translate"
import SectionForm, { SectionFormValues } from "./section-form"
import SectionList from "./section-list"
import {
  PageDTO,
  PageKey,
  SECTION_LABELS,
  SECTION_TYPES,
  SectionDTO,
  SectionType,
} from "../types"

function pagePathLabel(key: PageKey): string {
  if (key === "home") {
    return "/"
  }
  if (key === "product") {
    return "/products/*"
  }
  return `/static/${key}`
}

export default function PagesScreen() {
  const [pages, setPages] = useState<PageDTO[]>([])
  const [pageKey, setPageKey] = useState<PageKey | null>(null)
  const [sections, setSections] = useState<SectionDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draftType, setDraftType] = useState<SectionType>("quick-categories")
  const [editor, setEditor] = useState<SectionDTO | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SectionDTO | null>(null)
  const [pageEditor, setPageEditor] = useState<PageEditorState | null>(null)
  const [pendingDeletePage, setPendingDeletePage] = useState<PageDTO | null>(null)

  const loadPages = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api<{ pages: PageDTO[] }>("/admin/kibipage/pages")
      setPages(response.pages)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sayfalar yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSections = useCallback(async (key: PageKey) => {
    setLoading(true)
    try {
      const response = await api<{ sections: SectionDTO[] }>(
        `/admin/kibipage/pages/${encodeURIComponent(key)}/sections`
      )
      setSections(response.sections)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölümler yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPages()
  }, [loadPages])

  const openPage = async (key: PageKey) => {
    setPageKey(key)
    await loadSections(key)
  }

  const savePage = async (values: PageFormValues) => {
    if (!pageEditor) {
      return
    }

    setSaving(true)
    try {
      if (pageEditor.mode === "create") {
        const response = await api<{ page: PageDTO }>("/admin/kibipage/pages", {
          method: "POST",
          body: JSON.stringify(values),
        })
        toast.success("Sayfa eklendi.")
        setPageEditor(null)
        await loadPages()
        await openPage(response.page.key)
      } else {
        const response = await api<{ page: PageDTO }>(
          `/admin/kibipage/pages/${encodeURIComponent(pageEditor.page.id)}`,
          {
            method: "POST",
            body: JSON.stringify(values),
          }
        )
        toast.success("Sayfa güncellendi.")
        setPageEditor(null)
        await loadPages()
        if (pageKey === pageEditor.page.key) {
          setPageKey(response.page.key)
          await loadSections(response.page.key)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const removePage = async () => {
    if (!pendingDeletePage) {
      return
    }

    setSaving(true)
    try {
      await api(
        `/admin/kibipage/pages/${encodeURIComponent(pendingDeletePage.id)}`,
        { method: "DELETE" }
      )
      toast.success("Sayfa silindi.")
      const deletedKey = pendingDeletePage.key
      setPendingDeletePage(null)
      if (pageKey === deletedKey) {
        setPageKey(null)
      }
      await loadPages()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sayfa silinemedi.")
    } finally {
      setSaving(false)
    }
  }

  const addSection = async () => {
    if (!pageKey) {
      return
    }

    setSaving(true)
    try {
      const response = await api<{ section: SectionDTO }>(
        `/admin/kibipage/pages/${encodeURIComponent(pageKey)}/sections`,
        {
          method: "POST",
          body: JSON.stringify({ type: draftType }),
        }
      )
      toast.success("Bölüm eklendi.")
      await loadSections(pageKey)
      setEditor(response.section)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm eklenemedi.")
    } finally {
      setSaving(false)
    }
  }

  const saveSection = async (values: SectionFormValues) => {
    if (!editor || !pageKey) {
      return
    }

    setSaving(true)
    try {
      await api(`/admin/kibipage/sections/${editor.id}`, {
        method: "POST",
        body: JSON.stringify(values),
      })
      toast.success("Bölüm güncellendi.")
      setEditor(null)
      await loadSections(pageKey)
    } finally {
      setSaving(false)
    }
  }

  const reorder = async (next: SectionDTO[]) => {
    if (!pageKey) {
      return
    }

    const previous = sections
    setSections(next)
    setSaving(true)
    try {
      await api("/admin/kibipage/reorder", {
        method: "POST",
        body: JSON.stringify({
          page_key: pageKey,
          items: next.map((section, position) => ({
            id: section.id,
            position,
          })),
        }),
      })
    } catch (error) {
      setSections(previous)
      toast.error(error instanceof Error ? error.message : "Sıralama kaydedilemedi.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!pendingDelete || !pageKey) {
      return
    }

    setSaving(true)
    try {
      await api(`/admin/kibipage/sections/${pendingDelete.id}`, { method: "DELETE" })
      toast.success("Bölüm silindi.")
      setPendingDelete(null)
      await loadSections(pageKey)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm silinemedi.")
    } finally {
      setSaving(false)
    }
  }

  const currentPage = pages.find((page) => page.key === pageKey)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">{currentPage ? currentPage.label : "Sayfalar"}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {currentPage
              ? currentPage.key === "product"
                ? "Ürün adı, fiyat, görsel ve açıklama üründen gelir. Bölümler satın alma alanına, sağ sütuna veya açıklamanın altına yerleşir."
                : `${pagePathLabel(currentPage.key)} · Bölüm ekleyin, tutamacından sürükleyerek sıralayın. Aynı tür birden fazla eklenebilir.`
              : "Sayfa ekleyin, başlık ve anahtarlarını düzenleyin veya bölümlerini yönetin."}
          </Text>
        </div>
        {currentPage ? (
          <div className="flex items-center gap-x-2">
            <PageTranslate
              sections={sections}
              disabled={saving || loading}
              onTranslated={() => void loadSections(currentPage.key)}
            />
            <Button
              size="small"
              variant="secondary"
              disabled={saving}
              onClick={() => setPageEditor({ mode: "edit", page: currentPage })}
            >
              Sayfa bilgisi
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setPageKey(null)
                void loadPages()
              }}
            >
              Sayfalara dön
            </Button>
          </div>
        ) : (
          <Button
            size="small"
            disabled={saving || loading}
            onClick={() => setPageEditor({ mode: "create" })}
          >
            Sayfa ekle
          </Button>
        )}
      </div>
      <div className="px-6 py-4">
        {!currentPage ? (
          loading ? (
            <Text size="small" className="text-ui-fg-subtle">
              Yükleniyor...
            </Text>
          ) : (
            <div className="flex flex-col gap-y-2">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center justify-between gap-x-3 rounded-lg border border-ui-border-base px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-x-2">
                      <Text weight="plus" className="truncate">
                        {page.label}
                      </Text>
                      {page.is_system && (
                        <Badge color="grey" size="2xsmall">
                          Sistem
                        </Badge>
                      )}
                    </div>
                    <Text size="small" className="text-ui-fg-subtle">
                      {pagePathLabel(page.key)} · {page.section_count} bölüm
                    </Text>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => setPageEditor({ mode: "edit", page })}
                    >
                      Ad / URL
                    </Button>
                    <Button size="small" onClick={() => void openPage(page.key)}>
                      Düzenle
                    </Button>
                    {!page.is_system && (
                      <Button
                        size="small"
                        variant="danger"
                        onClick={() => setPendingDeletePage(page)}
                      >
                        Sil
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Select
                  value={draftType}
                  onValueChange={(value: SectionType) => setDraftType(value)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {SECTION_TYPES.map((type) => (
                      <Select.Item key={type} value={type}>
                        {SECTION_LABELS[type]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <Button size="small" disabled={saving} onClick={() => void addSection()}>
                Bölüm ekle
              </Button>
            </div>
            {loading ? (
              <Text size="small" className="text-ui-fg-subtle">
                Yükleniyor...
              </Text>
            ) : sections.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                Bu sayfada henüz bölüm yok. Hızlı kategoriler boş eklenir; kategorileri bölümün içinden doldurursunuz.
              </Text>
            ) : (
              <SectionList
                sections={sections}
                pageKey={currentPage.key}
                disabled={saving}
                onReorder={(next) => void reorder(next)}
                onEdit={setEditor}
                onDelete={setPendingDelete}
              />
            )}
          </div>
        )}
      </div>
      <PageForm
        editor={pageEditor}
        saving={saving}
        onClose={() => setPageEditor(null)}
        onSubmit={savePage}
      />
      <SectionForm
        section={editor}
        pageKey={pageKey}
        saving={saving}
        onClose={() => setEditor(null)}
        onSubmit={saveSection}
      />
      <Prompt
        open={!!pendingDelete}
        variant="danger"
        onOpenChange={(open) => !open && !saving && setPendingDelete(null)}
      >
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Bölümü sil</Prompt.Title>
            <Prompt.Description>
              {pendingDelete
                ? `"${pendingDelete.name}" kalıcı olarak silinecek.`
                : "Bu bölüm silinecek."}
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
      <Prompt
        open={!!pendingDeletePage}
        variant="danger"
        onOpenChange={(open) => !open && !saving && setPendingDeletePage(null)}
      >
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Sayfayı sil</Prompt.Title>
            <Prompt.Description>
              {pendingDeletePage
                ? `"${pendingDeletePage.label}" sayfası ve içindeki tüm bölümler kalıcı olarak silinecek.`
                : "Bu sayfa silinecek."}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel disabled={saving}>Vazgeç</Prompt.Cancel>
            <Prompt.Action onClick={() => void removePage()} disabled={saving}>
              Sil
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}
