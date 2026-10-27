import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { FormEvent, useCallback, useEffect, useState } from "react"

import {
  CategoryOption,
  CurrencyOption,
  ImportJobDTO,
  ImportStatus,
  ImportSummary,
  LocationOption,
} from "../types"
import { api } from "./api"

const STATUS_LABELS: Record<ImportStatus, string> = {
  pending: "Bekliyor",
  processing: "Çalışıyor",
  completed: "Tamamlandı",
  failed: "Hatalı",
}

const STATUS_COLORS: Record<ImportStatus, "grey" | "orange" | "green" | "red"> = {
  pending: "grey",
  processing: "orange",
  completed: "green",
  failed: "red",
}

export default function ImportScreen() {
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([])
  const [jobs, setJobs] = useState<ImportJobDTO[]>([])
  const [urls, setUrls] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [currencyCode, setCurrencyCode] = useState("")
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api<{
        jobs: ImportJobDTO[]
        categories: CategoryOption[]
        locations: LocationOption[]
        currencies: CurrencyOption[]
      }>("/admin/kibiimport")
      setJobs(response.jobs)
      setCategories(response.categories)
      setLocations(response.locations)
      setCurrencies(response.currencies)
      setCurrencyCode((current) =>
        response.currencies.some((currency) => currency.code === current)
          ? current
          : response.currencies.find((currency) => currency.is_default)?.code ??
            response.currencies[0]?.code ??
            ""
      )
      setLocationIds((current) =>
        current.filter((id) => response.locations.some((location) => location.id === id))
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İçe aktarma listesi yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    if (!categoryId) {
      toast.error("Kategori seçin.")
      return
    }

    if (!currencyCode) {
      toast.error("Para birimi seçin.")
      return
    }

    setSaving(true)
    try {
      const response = await api<{ jobs: ImportJobDTO[]; summary: ImportSummary }>(
        "/admin/kibiimport",
        {
          method: "POST",
          body: JSON.stringify({
            urls,
            category_id: categoryId,
            location_ids: locationIds,
            currency_code: currencyCode,
          }),
        }
      )
      setJobs(response.jobs)
      setUrls("")

      for (const line of response.summary.lines) {
        if (line.includes("başarısız") || line.includes("içe aktarılamadı")) {
          toast.error(line)
        } else {
          toast.success(line)
        }
      }

      for (const line of response.summary.skipped) {
        toast.error(line)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İçe aktarma başlatılamadı.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h1">Ürün aktar</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Her satıra bir ürün linki yazın. Linkler tek tek, aralarında 1 saniye beklenerek
            içe aktarılır. Kaynak HTTP hatası döndürürse bekleme art arda her hatada 2 saniye
            artar (2, 4, 6 sn), başarılı aktarımda 1 saniyeye döner. Ürünün diğer
            renkleri de aynı kategori ve lokasyonlarla kuyruğa eklenir. Sayfa kuyruk bitene
            kadar bekler.
          </Text>
        </div>
        <form className="flex flex-col gap-y-4 px-6 py-4" onSubmit={submit}>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="kibiimport-urls" size="small">
              Ürün linkleri
            </Label>
            <Textarea
              id="kibiimport-urls"
              rows={8}
              value={urls}
              onChange={(event) => setUrls(event.target.value)}
              placeholder={"https://www.trendyol.com/...\nhttps://www.trendyol.com/..."}
              required
            />
            <Text size="small" className="text-ui-fg-subtle">
              Her satıra bir ürün linki girin.
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small">Kategori</Label>
            <Select value={categoryId || undefined} onValueChange={setCategoryId}>
              <Select.Trigger>
                <Select.Value placeholder="Kategori seçin" />
              </Select.Trigger>
              <Select.Content>
                {categories.map((category) => (
                  <Select.Item key={category.id} value={category.id}>
                    {category.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Text size="small" className="text-ui-fg-subtle">
              Metinler ürün kaydına yazılır.
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small">Para birimi</Label>
            <Select value={currencyCode || undefined} onValueChange={setCurrencyCode}>
              <Select.Trigger>
                <Select.Value placeholder="Para birimi seçin" />
              </Select.Trigger>
              <Select.Content>
                {currencies.map((currency) => (
                  <Select.Item key={currency.code} value={currency.code}>
                    {currencyLabel(currency.code)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Text size="small" className="text-ui-fg-subtle">
              Kaynaktaki fiyat bu para birimine, kur çevrimi yapılmadan yazılır. Ürün daha önce
              aktarıldıysa diğer para birimlerindeki fiyatları korunur.
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small">Stok lokasyonları</Label>
            {locations.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                {loading ? "Yükleniyor" : "Stok lokasyonu yok."}
              </Text>
            ) : (
              <div className="flex flex-col gap-y-2">
                {locations.map((location) => (
                  <div key={location.id} className="flex items-center gap-x-2">
                    <Checkbox
                      id={`kibiimport-location-${location.id}`}
                      checked={locationIds.includes(location.id)}
                      onCheckedChange={(checked) =>
                        setLocationIds((current) =>
                          checked === true
                            ? [...current.filter((id) => id !== location.id), location.id]
                            : current.filter((id) => id !== location.id)
                        )
                      }
                    />
                    <Label htmlFor={`kibiimport-location-${location.id}`} size="small">
                      {location.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
            <Text size="small" className="text-ui-fg-subtle">
              Kaynakta stokta olan her varyanta seçilen lokasyonlarda en az 3 adet stok yazılır.
              Tükenmiş varyantlar 0 adetle eklenir. Lokasyon seçilmezse stok değiştirilmez.
            </Text>
          </div>
          <div>
            <Button type="submit" isLoading={saving} disabled={loading || !categories.length}>
              Linkten aktar
            </Button>
          </div>
        </form>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Kuyruk</Heading>
        </div>
        {loading ? (
          <Text className="px-6 py-4" size="small">
            Yükleniyor
          </Text>
        ) : jobs.length === 0 ? (
          <Text className="text-ui-fg-subtle px-6 py-4" size="small">
            Henüz içe aktarma yok.
          </Text>
        ) : (
          <div className="flex flex-col">
            {jobs.map((job) => (
              <article key={job.id} className="flex flex-col gap-y-2 px-6 py-4">
                <div className="flex items-start justify-between gap-x-4">
                  <Text size="small" className="break-all">
                    {job.url}
                  </Text>
                  <Badge color={STATUS_COLORS[job.status]} size="2xsmall">
                    {STATUS_LABELS[job.status]}
                  </Badge>
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  {job.parent_id ? "Renk seçeneği · " : ""}
                  {job.category_name || "—"}
                  {job.location_names.length ? ` · ${job.location_names.join(", ")}` : ""}
                  {job.currency_code ? ` · ${job.currency_code.toUpperCase()}` : ""} ·
                  Başlangıç {formatWhen(job.started_at)} · Bitiş{" "}
                  {formatWhen(job.finished_at)}
                </Text>
                {job.result ? (
                  <pre className="text-ui-fg-subtle overflow-auto whitespace-pre-wrap text-xs">
                    {job.result}
                  </pre>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Container>
    </div>
  )
}

function currencyLabel(code: string): string {
  const upper = code.toUpperCase()

  try {
    const name = new Intl.DisplayNames(["tr-TR"], { type: "currency" }).of(upper)
    return name && name !== upper ? `${upper} · ${name}` : upper
  } catch {
    return upper
  }
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
