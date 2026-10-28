import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react"

import { api } from "../../kibiimport/admin/api"
import { CategoryOption, CurrencyOption, LocationOption } from "../../kibiimport/types"
import { BatchDTO, BatchStatus, ItemDTO, ItemStatus, ITEM_STATUSES } from "../types"

type BadgeColor = "grey" | "orange" | "green" | "red" | "blue" | "purple"

const BATCH_LABELS: Record<BatchStatus, [string, BadgeColor]> = {
  ready: ["Hazır", "blue"],
  queued: ["Kuyrukta", "grey"],
  running: ["Çalışıyor", "orange"],
  paused: ["Duraklatıldı", "purple"],
  completed: ["Tamamlandı", "green"],
  completed_with_errors: ["Hatalarla bitti", "red"],
  cancelled: ["İptal edildi", "grey"],
}

const ITEM_LABELS: Record<ItemStatus, [string, BadgeColor]> = {
  pending: ["Bekliyor", "grey"],
  processing: ["Çalışıyor", "orange"],
  completed: ["Tamamlandı", "green"],
  failed: ["Hatalı", "red"],
  skipped: ["Atlandı", "purple"],
  cancelled: ["İptal", "grey"],
}

const NO_CATEGORY = "__document__"
const ALL_ITEMS = "__all__"
const PAGE_SIZE = 50
const POLL_MS = 3000

type Page = {
  batches: BatchDTO[]
  categories: CategoryOption[]
  locations: LocationOption[]
  currencies: CurrencyOption[]
  image_root: string
}

type Detail = {
  batch: BatchDTO
  items: ItemDTO[]
  count: number
  offset: number
  limit: number
}

export default function JsonScreen() {
  const [page, setPage] = useState<Page | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>(ALL_ITEMS)
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)

  const loadPage = useCallback(async () => {
    try {
      setPage(await api<Page>("/admin/kibijson/batches"))
    } catch (error) {
      toast.error(messageOf(error, "Partiler yüklenemedi."))
    }
  }, [])

  const loadDetail = useCallback(async () => {
    if (!selectedId) {
      setDetail(null)
      return
    }

    const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) })

    if (statusFilter !== ALL_ITEMS) {
      params.set("status", statusFilter)
    }

    try {
      setDetail(await api<Detail>(`/admin/kibijson/batches/${selectedId}?${params}`))
    } catch (error) {
      toast.error(messageOf(error, "Parti yüklenemedi."))
    }
  }, [selectedId, offset, statusFilter])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const active = detail && ["queued", "running"].includes(detail.batch.status)
  const anyActive = page?.batches.some((batch) => ["queued", "running"].includes(batch.status))

  useEffect(() => {
    if (!active && !anyActive) {
      return
    }

    const timer = setInterval(() => {
      void loadPage()
      void loadDetail()
    }, POLL_MS)

    return () => clearInterval(timer)
  }, [active, anyActive, loadPage, loadDetail])

  const act = async (path: string, init: RequestInit, done: string) => {
    setBusy(true)
    try {
      await api(path, init)
      toast.success(done)

      if (init.method === "DELETE") {
        setSelectedId(null)
        await loadPage()
        return
      }

      await Promise.all([loadPage(), loadDetail()])
    } catch (error) {
      toast.error(messageOf(error, "İşlem tamamlanamadı."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <UploadForm
        imageRoot={page?.image_root ?? ""}
        onCreated={async (batch) => {
          await loadPage()
          setOffset(0)
          setStatusFilter(ALL_ITEMS)
          setSelectedId(batch.id)
        }}
      />

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Partiler</Heading>
        </div>
        {!page ? (
          <Text size="small" className="px-6 py-4">
            Yükleniyor
          </Text>
        ) : page.batches.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle px-6 py-4">
            Henüz JSON partisi yok.
          </Text>
        ) : (
          <div className="flex flex-col">
            {page.batches.map((batch) => (
              <button
                key={batch.id}
                type="button"
                onClick={() => {
                  setSelectedId(batch.id)
                  setOffset(0)
                  setStatusFilter(ALL_ITEMS)
                }}
                className={`flex items-center justify-between gap-x-4 px-6 py-3 text-left hover:bg-ui-bg-base-hover ${
                  batch.id === selectedId ? "bg-ui-bg-base-pressed" : ""
                }`}
              >
                <div className="flex min-w-0 flex-col">
                  <Text size="small" weight="plus" className="truncate">
                    {batch.name}
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    {batch.source} · {formatWhen(batch.created_at)} · {progressOf(batch)}
                  </Text>
                </div>
                <StatusBadge labels={BATCH_LABELS} status={batch.status} />
              </button>
            ))}
          </div>
        )}
      </Container>

      {detail && page ? (
        <BatchPanel
          detail={detail}
          page={page}
          busy={busy}
          statusFilter={statusFilter}
          onFilter={(value) => {
            setStatusFilter(value)
            setOffset(0)
          }}
          onOffset={setOffset}
          act={act}
        />
      ) : null}
    </div>
  )
}

function UploadForm({
  imageRoot,
  onCreated,
}: {
  imageRoot: string
  onCreated: (batch: BatchDTO) => Promise<void>
}) {
  const [document, setDocument] = useState<unknown>(undefined)
  const [fileName, setFileName] = useState("")
  const [serverFile, setServerFile] = useState("")
  const [name, setName] = useState("")
  const [imageBase, setImageBase] = useState("")
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      setDocument(JSON.parse(await file.text()))
      setFileName(file.name)
      setServerFile("")
    } catch {
      setDocument(undefined)
      setFileName("")
      toast.error("Dosya geçerli bir JSON değil.")
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    if (document === undefined && !serverFile.trim()) {
      toast.error("Bir JSON dosyası seçin veya sunucudaki dosyanın yolunu yazın.")
      return
    }

    setSaving(true)
    try {
      const { batch } = await api<{ batch: BatchDTO }>("/admin/kibijson/batches", {
        method: "POST",
        body: JSON.stringify({
          ...(document !== undefined ? { document } : { file: serverFile.trim() }),
          name: name.trim() || fileName || undefined,
          ...(imageBase.trim() ? { image_base: imageBase.trim() } : {}),
        }),
      })
      toast.success(
        `${batch.pending} ürün hazır${batch.skipped ? `, ${batch.skipped} ürün atlandı` : ""}.`
      )
      setDocument(undefined)
      setFileName("")
      setServerFile("")
      setName("")
      setImageBase("")

      if (input.current) {
        input.current.value = ""
      }

      await onCreated(batch)
    } catch (error) {
      toast.error(messageOf(error, "Dosya kontrol edilemedi."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">JSON'dan ürün aktar</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          kibiimport.product/v1 biçimindeki dosya önce kontrol edilir; katalogda hiçbir şey
          değişmez. Rapora bakıp partiyi başlattığınızda ürünler arka planda tek tek aktarılır,
          sayfayı kapatabilirsiniz. Link olmayan görseller FTP klasöründen okunur:{" "}
          <code>{imageRoot || "—"}</code>
        </Text>
      </div>
      <form className="flex flex-col gap-y-4 px-6 py-4" onSubmit={submit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label size="small">JSON dosyası (bilgisayardan)</Label>
            <input
              ref={input}
              type="file"
              accept="application/json,.json"
              onChange={pick}
              className="text-ui-fg-subtle text-sm"
            />
            <Text size="small" className="text-ui-fg-subtle">
              En fazla 50 MB. Daha büyük dosyaları FTP ile yükleyip yolunu yazın.
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small" htmlFor="kibijson-file">
              veya sunucudaki JSON dosyası
            </Label>
            <Input
              id="kibijson-file"
              value={serverFile}
              disabled={document !== undefined}
              onChange={(event) => setServerFile(event.target.value)}
              placeholder="eski-site-2026-10-28/products.json"
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small" htmlFor="kibijson-name">
              Parti adı
            </Label>
            <Input
              id="kibijson-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={fileName || "Ekim kataloğu"}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small" htmlFor="kibijson-image-base">
              Görsel klasörü
            </Label>
            <Input
              id="kibijson-image-base"
              value={imageBase}
              onChange={(event) => setImageBase(event.target.value)}
              placeholder="Boşsa dosyadaki image_base kullanılır"
            />
          </div>
        </div>
        <div>
          <Button type="submit" isLoading={saving}>
            Dosyayı kontrol et
          </Button>
        </div>
      </form>
    </Container>
  )
}

function BatchPanel({
  detail,
  page,
  busy,
  statusFilter,
  onFilter,
  onOffset,
  act,
}: {
  detail: Detail
  page: Page
  busy: boolean
  statusFilter: string
  onFilter: (value: string) => void
  onOffset: (value: number) => void
  act: (path: string, init: RequestInit, done: string) => Promise<void>
}) {
  const { batch, items, count, offset } = detail
  const base = `/admin/kibijson/batches/${batch.id}`
  const report = batch.report
  const post: RequestInit = { method: "POST" }
  const retryable = ["completed", "completed_with_errors", "cancelled", "paused", "queued", "running"].includes(
    batch.status
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <div className="flex items-center gap-x-2">
            <Heading level="h2">{batch.name}</Heading>
            <StatusBadge labels={BATCH_LABELS} status={batch.status} />
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            {batch.source} · {batch.schema} · görsel klasörü {batch.image_base || "kök"} ·{" "}
            {progressOf(batch)}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Başlangıç {formatWhen(batch.started_at)} · Bitiş {formatWhen(batch.finished_at)}
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {["queued", "running"].includes(batch.status) ? (
            <Button size="small" variant="secondary" disabled={busy} onClick={() => act(`${base}/pause`, post, "Parti duraklatıldı.")}>
              Duraklat
            </Button>
          ) : null}
          {batch.status === "paused" ? (
            <Button size="small" variant="secondary" disabled={busy} onClick={() => act(`${base}/resume`, post, "Parti devam ediyor.")}>
              Devam et
            </Button>
          ) : null}
          {retryable && (batch.failed > 0 || batch.skipped > 0) ? (
            <Button size="small" variant="secondary" disabled={busy} onClick={() => act(`${base}/retry`, post, "Hatalı ürünler yeniden kuyrukta.")}>
              Hatalıları yeniden dene
            </Button>
          ) : null}
          {["ready", "queued", "running", "paused"].includes(batch.status) ? (
            <Button size="small" variant="secondary" disabled={busy} onClick={() => act(`${base}/cancel`, post, "Parti iptal edildi.")}>
              İptal et
            </Button>
          ) : null}
          <Button
            size="small"
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Parti ve satırları silinsin mi? Aktarılmış ürünler silinmez.")) {
                return
              }
              await act(base, { method: "DELETE" }, "Parti silindi.")
            }}
          >
            Sil
          </Button>
        </div>
      </div>

      {report ? (
        <div className="flex flex-col gap-y-2 px-6 py-4">
          <Heading level="h3">Ön kontrol</Heading>
          <Text size="small">
            {report.products} ürün, {report.variants} varyant · {report.ready} hazır, {report.invalid} hatalı ·
            görseller: {report.images.local} dosya, {report.images.remote} link, {report.images.missing} eksik
            {report.needs_category ? ` · ${report.needs_category} ürünün kategorisi dosyada bulunamadı` : ""}
          </Text>
          {report.lines.length ? (
            <div className="max-h-64 overflow-auto rounded border border-ui-border-base">
              {report.lines.map((line, index) => (
                <Text
                  key={index}
                  size="xsmall"
                  className={`border-b border-ui-border-base px-3 py-1 last:border-b-0 ${
                    line.level === "error" ? "text-ui-fg-error" : "text-ui-fg-subtle"
                  }`}
                >
                  #{line.position} {line.code} / {line.color}: {line.message}
                </Text>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {batch.status === "ready" ? <StartForm batch={batch} page={page} busy={busy} act={act} /> : null}

      <div className="flex flex-col gap-y-3 px-6 py-4">
        <div className="flex items-center justify-between gap-x-4">
          <Heading level="h3">Ürünler</Heading>
          <div className="w-48">
            <Select value={statusFilter} onValueChange={onFilter}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={ALL_ITEMS}>Tümü</Select.Item>
                {ITEM_STATUSES.map((status) => (
                  <Select.Item key={status} value={status}>
                    {ITEM_LABELS[status][0]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>#</Table.HeaderCell>
              <Table.HeaderCell>Ürün</Table.HeaderCell>
              <Table.HeaderCell>Durum</Table.HeaderCell>
              <Table.HeaderCell>Sonuç</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.id} className="align-top">
                <Table.Cell>{item.position}</Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col py-2">
                    <Text size="small" weight="plus">
                      {item.product_id ? <a className="text-ui-fg-interactive" href={`/app/products/${item.product_id}`}>{item.title}</a> : item.title}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {item.code} / {item.color}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col gap-y-1 py-2">
                    <StatusBadge labels={ITEM_LABELS} status={item.status} />
                    {item.attempts > 0 ? (
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Deneme {item.attempts}/{item.max_attempts}
                        {item.status === "pending" && item.next_run_at ? ` · ${formatWhen(item.next_run_at)}` : ""}
                      </Text>
                    ) : null}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex max-w-xl flex-col gap-y-1 py-2">
                    {item.result ? (
                      <Text size="xsmall">
                        {item.result.created ? "Oluşturuldu" : "Güncellendi"} · varyant {item.result.created_variants} yeni,{" "}
                        {item.result.updated_variants} güncel, {item.result.removed_variants} silindi · görsel{" "}
                        {item.result.images}
                        {item.result.images_kept ? " (değişmedi)" : ""}
                      </Text>
                    ) : null}
                    {item.error ? (
                      <Text size="xsmall" className="text-ui-fg-error whitespace-pre-wrap">
                        {item.error}
                      </Text>
                    ) : null}
                    {item.warnings.map((warning, index) => (
                      <Text key={index} size="xsmall" className="text-ui-fg-subtle">
                        {warning}
                      </Text>
                    ))}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {retryable && ["failed", "skipped", "cancelled", "completed"].includes(item.status) ? (
                    <Button
                      size="small"
                      variant="transparent"
                      disabled={busy}
                      onClick={() => act(`${base}/items/${item.id}/retry`, post, "Ürün yeniden kuyrukta.")}
                    >
                      Yeniden
                    </Button>
                  ) : null}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <div className="flex items-center justify-between">
          <Text size="small" className="text-ui-fg-subtle">
            {count ? `${offset + 1}–${Math.min(offset + items.length, count)} / ${count}` : "Ürün yok"}
          </Text>
          <div className="flex gap-2">
            <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - PAGE_SIZE))}>
              Önceki
            </Button>
            <Button size="small" variant="secondary" disabled={offset + PAGE_SIZE >= count} onClick={() => onOffset(offset + PAGE_SIZE)}>
              Sonraki
            </Button>
          </div>
        </div>
      </div>
    </Container>
  )
}

function StartForm({
  batch,
  page,
  busy,
  act,
}: {
  batch: BatchDTO
  page: Page
  busy: boolean
  act: (path: string, init: RequestInit, done: string) => Promise<void>
}) {
  const [categoryId, setCategoryId] = useState(NO_CATEGORY)
  const [currencyCode, setCurrencyCode] = useState(
    page.currencies.find((currency) => currency.is_default)?.code ?? page.currencies[0]?.code ?? ""
  )
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [skipUnchanged, setSkipUnchanged] = useState(batch.options.skip_unchanged)
  const [archiveImages, setArchiveImages] = useState(batch.options.archive_images)

  const start = () =>
    act(
      `/admin/kibijson/batches/${batch.id}/start`,
      {
        method: "POST",
        body: JSON.stringify({
          category_id: categoryId === NO_CATEGORY ? null : categoryId,
          currency_code: currencyCode || undefined,
          location_ids: locationIds,
          options: { skip_unchanged: skipUnchanged, archive_images: archiveImages },
        }),
      },
      "Parti kuyruğa alındı."
    )

  return (
    <div className="flex flex-col gap-y-4 px-6 py-4">
      <Heading level="h3">Başlat</Heading>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-y-2">
          <Label size="small">Ana kategori</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={NO_CATEGORY}>Dosyadaki kategoriler</Select.Item>
              {page.categories.map((category) => (
                <Select.Item key={category.id} value={category.id}>
                  {category.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Text size="small" className="text-ui-fg-subtle">
            Seçilirse her ürün bu kategoriye de eklenir; dosyadaki kategoriler yine eklenir.
            {batch.report?.needs_category ? ` ${batch.report.needs_category} ürün için seçmek zorunlu.` : ""}
          </Text>
        </div>
        <div className="flex flex-col gap-y-2">
          <Label size="small">Varsayılan para birimi</Label>
          <Select value={currencyCode || undefined} onValueChange={setCurrencyCode}>
            <Select.Trigger>
              <Select.Value placeholder="Para birimi seçin" />
            </Select.Trigger>
            <Select.Content>
              {page.currencies.map((currency) => (
                <Select.Item key={currency.code} value={currency.code}>
                  {currency.code.toUpperCase()}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Text size="small" className="text-ui-fg-subtle">
            Dosyadaki her fiyat kendi para birimine yazılır. İndirim öncesi fiyat (metadata) bu
            para birimine göre tutulur.
          </Text>
        </div>
      </div>
      <div className="flex flex-col gap-y-2">
        <Label size="small">Stok lokasyonları</Label>
        {page.locations.length ? (
          page.locations.map((location) => (
            <div key={location.id} className="flex items-center gap-x-2">
              <Checkbox
                id={`kibijson-location-${location.id}`}
                checked={locationIds.includes(location.id)}
                onCheckedChange={(checked) =>
                  setLocationIds((current) =>
                    checked === true
                      ? [...current.filter((id) => id !== location.id), location.id]
                      : current.filter((id) => id !== location.id)
                  )
                }
              />
              <Label htmlFor={`kibijson-location-${location.id}`} size="small">
                {location.name}
              </Label>
            </div>
          ))
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            Stok lokasyonu yok.
          </Text>
        )}
        <Text size="small" className="text-ui-fg-subtle">
          Dosyada adet varsa seçilen her lokasyona o adet yazılır; yoksa stoktaki varyantlara en az 3
          adet yazılır. Lokasyon seçilmezse stok değiştirilmez.
        </Text>
      </div>
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center gap-x-2">
          <Checkbox id="kibijson-skip" checked={skipUnchanged} onCheckedChange={(checked) => setSkipUnchanged(checked === true)} />
          <Label htmlFor="kibijson-skip" size="small">
            Değişmeyen ürünleri atla (aynı içerik, görsel ve ayarlarla daha önce aktarıldıysa)
          </Label>
        </div>
        <div className="flex items-center gap-x-2">
          <Checkbox id="kibijson-archive" checked={archiveImages} onCheckedChange={(checked) => setArchiveImages(checked === true)} />
          <Label htmlFor="kibijson-archive" size="small">
            Parti hatasız bitince görsel klasörünü _processed altına taşı
          </Label>
        </div>
      </div>
      <div>
        <Button disabled={busy || !batch.pending} onClick={start}>
          {batch.pending} ürünü aktar
        </Button>
      </div>
    </div>
  )
}

function StatusBadge<T extends string>({
  labels,
  status,
}: {
  labels: Record<T, [string, BadgeColor]>
  status: T
}) {
  const [label, color] = labels[status]

  return (
    <Badge color={color} size="2xsmall">
      {label}
    </Badge>
  )
}

function progressOf(batch: BatchDTO): string {
  const done = batch.completed + batch.failed + batch.skipped
  return `${done}/${batch.total} işlendi · ${batch.completed} başarılı, ${batch.failed} hatalı, ${batch.skipped} atlandı`
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatWhen(value: string | null): string {
  if (!value) {
    return "—"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return date.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
