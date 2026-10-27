import { ArrowUturnLeft, PencilSquare, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Drawer,
  Heading,
  IconButton,
  Input,
  Label,
  Prompt,
  Select,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import type { MemoryEntryDTO } from "../service"
import { request } from "./api"

const PAGE_SIZE = 50
const ALL = "__all"

type MemoryPage = {
  entries: MemoryEntryDTO[]
  count: number
  locales: { source: string[]; target: string[] }
}

function shortDate(value: string | null) {
  return value ? new Date(value).toLocaleString("tr-TR") : "—"
}

function LocaleFilter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex min-w-40 flex-col gap-y-1">
      <Label htmlFor={id} size="xsmall">
        {label}
      </Label>
      <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? "" : next)}>
        <Select.Trigger id={id}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={ALL}>Tümü</Select.Item>
          {options.map((option) => (
            <Select.Item key={option} value={option}>
              {option}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </div>
  )
}

export default function MemoryScreen() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [source, setSource] = useState("")
  const [target, setTarget] = useState("")
  const [data, setData] = useState<MemoryPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<MemoryEntryDTO | null>(null)
  const [draft, setDraft] = useState("")
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    })
    if (query) params.set("q", query)
    if (source) params.set("source_locale", source)
    if (target) params.set("target_locale", target)

    try {
      setData(await request<MemoryPage>(`/admin/kibitranslate/memory?${params}`))
      setSelected([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Çeviri hafızası yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [page, query, source, target])

  useEffect(() => {
    void load()
  }, [load])

  const entries = data?.entries ?? []
  const count = data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const allSelected = entries.length > 0 && entries.every((entry) => selected.includes(entry.id))

  const openEdit = (entry: MemoryEntryDTO) => {
    setEditing(entry)
    setDraft(entry.translated_text)
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await request(`/admin/kibitranslate/memory/${editing.id}`, {
        method: "POST",
        body: JSON.stringify({ translated_text: draft }),
      })
      toast.success("Çeviri güncellendi.")
      setEditing(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Çeviri kaydedilemedi.")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete?.length) return
    setSaving(true)
    try {
      const body =
        pendingDelete.length === 1
          ? await request<{ deleted: boolean }>(`/admin/kibitranslate/memory/${pendingDelete[0]}`, {
              method: "DELETE",
            }).then(() => ({ deleted: 1 }))
          : await request<{ deleted: number }>("/admin/kibitranslate/memory/batch/delete", {
              method: "POST",
              body: JSON.stringify({ ids: pendingDelete }),
            })
      toast.success(`${body.deleted} kayıt silindi.`)
      setPendingDelete(null)
      if (entries.length === pendingDelete.length && page > 0) {
        setPage(page - 1)
      } else {
        await load()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kayıt silinemedi.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-x-4 px-6 py-4">
        <div>
          <Heading level="h1">Çeviri hafızası</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            AI çeviri sonuçları kaynak metnin hash&apos;i ile saklanır. Aynı metin aynı dil çifti
            için tekrar istendiğinde çeviri servisine gönderilmez, buradan kullanılır. Düzenlenen
            çeviriler sonraki çevirilerde de kullanılır; silinen kayıt bir sonraki istekte yeniden
            çevrilir.
          </Text>
        </div>
        <Button size="small" variant="secondary" asChild>
          <Link to="/kibisettings/translate">
            <ArrowUturnLeft />
            AI Çeviri ayarları
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 px-6 py-4">
        <div className="flex min-w-64 flex-1 flex-col gap-y-1">
          <Label htmlFor="memory-search" size="xsmall">
            Ara
          </Label>
          <Input
            id="memory-search"
            type="search"
            placeholder="Kaynak veya çeviri metninde ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <LocaleFilter
          id="memory-source"
          label="Kaynak dil"
          value={source}
          options={data?.locales.source ?? []}
          onChange={(value) => {
            setSource(value)
            setPage(0)
          }}
        />
        <LocaleFilter
          id="memory-target"
          label="Hedef dil"
          value={target}
          options={data?.locales.target ?? []}
          onChange={(value) => {
            setTarget(value)
            setPage(0)
          }}
        />
        <Button
          size="small"
          variant="danger"
          disabled={!selected.length || saving}
          onClick={() => setPendingDelete(selected)}
        >
          Seçilenleri sil ({selected.length})
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell className="w-10">
                <Checkbox
                  aria-label="Sayfadakilerin tümünü seç"
                  checked={allSelected}
                  disabled={!entries.length}
                  onCheckedChange={(checked) =>
                    setSelected(checked === true ? entries.map((entry) => entry.id) : [])
                  }
                />
              </Table.HeaderCell>
              <Table.HeaderCell>Kaynak</Table.HeaderCell>
              <Table.HeaderCell>Çeviri</Table.HeaderCell>
              <Table.HeaderCell>Kullanım</Table.HeaderCell>
              <Table.HeaderCell>Son kullanım</Table.HeaderCell>
              <Table.HeaderCell className="w-24" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {entries.map((entry) => (
              <Table.Row key={entry.id}>
                <Table.Cell>
                  <Checkbox
                    aria-label="Kaydı seç"
                    checked={selected.includes(entry.id)}
                    onCheckedChange={(checked) =>
                      setSelected((current) =>
                        checked === true
                          ? [...current, entry.id]
                          : current.filter((id) => id !== entry.id)
                      )
                    }
                  />
                </Table.Cell>
                <Table.Cell className="max-w-80 py-2 align-top">
                  <div className="flex flex-col gap-y-1">
                    <span className="flex gap-x-1">
                      <Badge size="2xsmall">{entry.source_locale}</Badge>
                      {entry.format === "html" ? <Badge size="2xsmall">HTML</Badge> : null}
                    </span>
                    <span className="line-clamp-3 whitespace-normal break-words">{entry.source_text}</span>
                  </div>
                </Table.Cell>
                <Table.Cell className="max-w-80 py-2 align-top">
                  <div className="flex flex-col gap-y-1">
                    <span className="flex gap-x-1">
                      <Badge size="2xsmall">{entry.target_locale}</Badge>
                      {entry.edited ? (
                        <Badge size="2xsmall" color="blue">
                          Düzenlendi
                        </Badge>
                      ) : entry.provider ? (
                        <Badge size="2xsmall" color="grey">
                          {entry.provider}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="line-clamp-3 whitespace-normal break-words">{entry.translated_text}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>{entry.hits}</Table.Cell>
                <Table.Cell className="whitespace-nowrap">{shortDate(entry.last_used_at ?? entry.created_at)}</Table.Cell>
                <Table.Cell>
                  <div className="flex justify-end gap-x-1">
                    <IconButton size="small" variant="transparent" aria-label="Düzenle" onClick={() => openEdit(entry)}>
                      <PencilSquare />
                    </IconButton>
                    <IconButton
                      size="small"
                      variant="transparent"
                      aria-label="Sil"
                      onClick={() => setPendingDelete([entry.id])}
                    >
                      <Trash />
                    </IconButton>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {!loading && !entries.length ? (
          <Text size="small" className="px-6 py-6 text-ui-fg-subtle">
            {query || source || target
              ? "Filtreye uyan kayıt yok."
              : "Henüz kayıt yok. AI translate ile yapılan çeviriler burada listelenir."}
          </Text>
        ) : null}
        <Table.Pagination
          count={count}
          pageSize={PAGE_SIZE}
          pageIndex={page}
          pageCount={pageCount}
          canPreviousPage={page > 0}
          canNextPage={page + 1 < pageCount}
          previousPage={() => setPage((current) => Math.max(0, current - 1))}
          nextPage={() => setPage((current) => current + 1)}
          translations={{ of: "/", results: "kayıt", pages: "sayfa", prev: "Önceki", next: "Sonraki" }}
        />
      </div>

      <Drawer open={!!editing} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Çeviriyi düzenle</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
            {editing ? (
              <>
                <div className="flex flex-col gap-y-1">
                  <Label size="small">Kaynak metin ({editing.source_locale})</Label>
                  <Text size="small" className="whitespace-pre-wrap break-words rounded-lg bg-ui-bg-subtle p-3">
                    {editing.source_text}
                  </Text>
                </div>
                <div className="flex flex-col gap-y-1">
                  <Label htmlFor="memory-translation" size="small">
                    Çeviri ({editing.target_locale})
                  </Label>
                  <Textarea
                    id="memory-translation"
                    rows={8}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  {editing.format === "html" ? (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Bu kayıt HTML içerir; etiketleri koruyun.
                    </Text>
                  ) : null}
                </div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Hash: {editing.hash}
                </Text>
              </>
            ) : null}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button type="button" variant="secondary" disabled={saving}>
                Vazgeç
              </Button>
            </Drawer.Close>
            <Button type="button" isLoading={saving} disabled={!draft.trim()} onClick={() => void saveEdit()}>
              Kaydet
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Prompt open={!!pendingDelete} variant="danger" onOpenChange={(open) => !open && !saving && setPendingDelete(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Kayıtları sil</Prompt.Title>
            <Prompt.Description>
              {pendingDelete?.length === 1
                ? "Bu çeviri kaydı silinecek. Aynı metin tekrar istenirse yeniden çevrilir."
                : `${pendingDelete?.length ?? 0} çeviri kaydı silinecek. Aynı metinler tekrar istenirse yeniden çevrilir.`}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel disabled={saving}>Vazgeç</Prompt.Cancel>
            <Prompt.Action onClick={() => void confirmDelete()} disabled={saving}>
              Sil
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}
