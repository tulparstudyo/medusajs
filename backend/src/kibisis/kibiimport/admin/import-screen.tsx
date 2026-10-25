import { Badge, Button, Container, Heading, Label, Select, Text, Textarea, toast } from "@medusajs/ui"
import { FormEvent, useCallback, useEffect, useState } from "react"

import { CategoryOption, ImportJobDTO, ImportStatus, ImportSummary } from "../types"
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
  const [jobs, setJobs] = useState<ImportJobDTO[]>([])
  const [urls, setUrls] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api<{ jobs: ImportJobDTO[]; categories: CategoryOption[] }>(
        "/admin/kibiimport"
      )
      setJobs(response.jobs)
      setCategories(response.categories)
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

    setSaving(true)
    try {
      const response = await api<{ jobs: ImportJobDTO[]; summary: ImportSummary }>(
        "/admin/kibiimport",
        {
          method: "POST",
          body: JSON.stringify({ urls, category_id: categoryId }),
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
            Her satıra bir ürün linki yazın. Linkler sırayla içe aktarılır. Sayfa kuyruk
            bitene kadar bekler.
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
              Metinler ürün kaydına yazılır. Fiyat mağazadaki her para birimine eklenir.
              Stok değiştirilmez.
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
                  {job.category_name || "—"} · Başlangıç {formatWhen(job.started_at)} · Bitiş{" "}
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
