import { Badge, Button, Checkbox, Container, Heading, Label, Select, Text, Textarea, toast } from "@medusajs/ui"
import { ChangeEvent, useCallback, useEffect, useState } from "react"

import { api } from "../../kibiimport/admin/api"
import { CategoryOption } from "../../kibiimport/types"
import { CategoryImportResult, HandleRebuildResult } from "../types"

const TOP_LEVEL = "__top__"

const EXAMPLE = `[
  {
    "category": "Giyim",
    "subcategories": ["Elbise", "Tişört", "Gömlek"]
  },
  {
    "category": "Ayakkabı",
    "subcategories": ["Sneaker", "Babet"]
  }
]`

export default function CategoryScreen() {
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [text, setText] = useState("")
  const [parentId, setParentId] = useState(TOP_LEVEL)
  const [isActive, setIsActive] = useState(true)
  const [isInternal, setIsInternal] = useState(false)
  const [result, setResult] = useState<CategoryImportResult | null>(null)
  const [saving, setSaving] = useState<"preview" | "import" | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await api<{ categories: CategoryOption[] }>("/admin/kibicategory")
      setCategories(response.categories)
    } catch (error) {
      toast.error(messageOf(error, "Kategoriler yüklenemedi."))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (file) {
      setText(await file.text())
      setResult(null)
    }

    event.target.value = ""
  }

  const send = async (dryRun: boolean) => {
    let document: unknown

    try {
      document = JSON.parse(text.replace(/^\uFEFF/, ""))
    } catch {
      toast.error("JSON geçerli değil.")
      return
    }

    setSaving(dryRun ? "preview" : "import")
    try {
      const response = await api<CategoryImportResult>("/admin/kibicategory", {
        method: "POST",
        body: JSON.stringify({
          document,
          parent_id: parentId === TOP_LEVEL ? null : parentId,
          is_active: isActive,
          is_internal: isInternal,
          dry_run: dryRun,
        }),
      })
      setResult(response)

      if (dryRun) {
        toast.success(`${response.created} kategori oluşturulacak, ${response.existing} kategori zaten var.`)
      } else {
        toast.success(`${response.created} kategori oluşturuldu, ${response.existing} kategori zaten vardı.`)
        await load()
      }
    } catch (error) {
      toast.error(messageOf(error, "Kategoriler aktarılamadı."))
    } finally {
      setSaving(null)
    }
  }

  const parentName = categories.find((category) => category.id === parentId)?.name

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h1">JSON'dan kategori aktar</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Her öğe bir kategoridir; <code>subcategories</code> içindekiler onun alt kategorisi olur
            ve iç içe yazılabilir. Seçilen üst kategorinin altında aynı adlı bir kategori varsa yenisi
            açılmaz, mevcut olan kullanılır; aynı dosyayı tekrar aktarmak kopya oluşturmaz. Yeni
            kategorilerin handle'ı ağaçtaki yoludur: <code>kadin/giyim/elbise</code>.
          </Text>
        </div>
        <div className="flex flex-col gap-y-4 px-6 py-4">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between gap-x-4">
              <Label size="small" htmlFor="kibicategory-json">
                Kategori JSON
              </Label>
              <input type="file" accept="application/json,.json" onChange={pick} className="text-ui-fg-subtle text-sm" />
            </div>
            <Textarea
              id="kibicategory-json"
              rows={14}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setResult(null)
              }}
              placeholder={EXAMPLE}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small">Üst kategori</Label>
            <Select
              value={parentId}
              onValueChange={(value) => {
                setParentId(value)
                setResult(null)
              }}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={TOP_LEVEL}>Yok (en üst seviye)</Select.Item>
                {categories.map((category) => (
                  <Select.Item key={category.id} value={category.id}>
                    {category.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Text size="small" className="text-ui-fg-subtle">
              Dosyadaki en üst kategoriler bu kategorinin altına eklenir.
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center gap-x-2">
              <Checkbox id="kibicategory-active" checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
              <Label htmlFor="kibicategory-active" size="small">
                Yeni kategoriler aktif olsun
              </Label>
            </div>
            <div className="flex items-center gap-x-2">
              <Checkbox id="kibicategory-internal" checked={isInternal} onCheckedChange={(checked) => setIsInternal(checked === true)} />
              <Label htmlFor="kibicategory-internal" size="small">
                Yeni kategoriler dahili olsun (vitrinde görünmez)
              </Label>
            </div>
          </div>
          <div className="flex gap-x-2">
            <Button variant="secondary" disabled={!text.trim() || saving !== null} isLoading={saving === "preview"} onClick={() => send(true)}>
              Önizle
            </Button>
            <Button disabled={!text.trim() || saving !== null} isLoading={saving === "import"} onClick={() => send(false)}>
              Kategorileri oluştur
            </Button>
          </div>
        </div>
      </Container>

      {result ? (
        <Container className="divide-y p-0">
          <div className="px-6 py-4">
            <Heading level="h2">{result.dry_run ? "Önizleme" : "Sonuç"}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {parentName ? `${parentName} altında` : "En üst seviyede"} · {result.total} kategori ·{" "}
              {result.created} {result.dry_run ? "oluşturulacak" : "oluşturuldu"} · {result.existing} zaten var
            </Text>
          </div>
          <div className="flex flex-col px-6 py-3">
            {result.entries.map((entry) => (
              <div
                key={entry.path.join("\u0000")}
                className="flex items-center justify-between gap-x-4 py-1"
                style={{ paddingLeft: `${(entry.depth - 1) * 24}px` }}
              >
                <Text size="small" weight={entry.depth === 1 ? "plus" : "regular"}>
                  {entry.name}
                  <span className="text-ui-fg-muted"> · {entry.handle}</span>
                </Text>
                <Badge size="2xsmall" color={entry.action === "create" ? "green" : "grey"}>
                  {entry.action === "create" ? (result.dry_run ? "Yeni" : "Oluşturuldu") : "Mevcut"}
                </Badge>
              </div>
            ))}
          </div>
        </Container>
      ) : null}

      <HandlesCard categories={categories} onApplied={load} />
    </div>
  )
}

function HandlesCard({
  categories,
  onApplied,
}: {
  categories: CategoryOption[]
  onApplied: () => Promise<void>
}) {
  const [scopeId, setScopeId] = useState(TOP_LEVEL)
  const [result, setResult] = useState<HandleRebuildResult | null>(null)
  const [saving, setSaving] = useState<"preview" | "apply" | null>(null)

  const send = async (dryRun: boolean) => {
    if (
      !dryRun &&
      !window.confirm("Kategori handle'ları değişecek; vitrindeki eski kategori adresleri çalışmayacak. Devam edilsin mi?")
    ) {
      return
    }

    setSaving(dryRun ? "preview" : "apply")
    try {
      const response = await api<HandleRebuildResult>("/admin/kibicategory/handles", {
        method: "POST",
        body: JSON.stringify({ parent_id: scopeId === TOP_LEVEL ? null : scopeId, dry_run: dryRun }),
      })
      setResult(response)
      toast.success(
        dryRun
          ? `${response.changed} kategorinin handle'ı değişecek.`
          : `${response.changed} kategorinin handle'ı güncellendi.`
      )

      if (!dryRun) {
        await onApplied()
      }
    } catch (error) {
      toast.error(messageOf(error, "Handle'lar güncellenemedi."))
    } finally {
      setSaving(null)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Handle'ları ağaca göre düzenle</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Mevcut kategorilerin handle'larını yerlerine göre yeniden yazar: Kadın &gt; Elbise →{" "}
          <code>kadin/elbise</code>. Türkçe karakterler ve işaretler temizlenir. Vitrindeki kategori
          adresleri de değişir; eski linkler çalışmaz.
        </Text>
      </div>
      <div className="flex flex-col gap-y-4 px-6 py-4">
        <div className="flex flex-col gap-y-2">
          <Label size="small">Kapsam</Label>
          <Select
            value={scopeId}
            onValueChange={(value) => {
              setScopeId(value)
              setResult(null)
            }}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={TOP_LEVEL}>Tüm kategoriler</Select.Item>
              {categories.map((category) => (
                <Select.Item key={category.id} value={category.id}>
                  {category.name} ve altı
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="flex gap-x-2">
          <Button variant="secondary" disabled={saving !== null} isLoading={saving === "preview"} onClick={() => send(true)}>
            Önizle
          </Button>
          <Button disabled={saving !== null} isLoading={saving === "apply"} onClick={() => send(false)}>
            Handle'ları güncelle
          </Button>
        </div>
      </div>
      {result ? (
        <div className="flex flex-col px-6 py-3">
          {result.changes.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              Tüm handle'lar zaten ağaca uygun.
            </Text>
          ) : (
            result.changes.map((change) => (
              <div key={change.id} className="flex flex-wrap items-center gap-x-2 py-1">
                <Text size="small" weight="plus">
                  {change.path.join(" > ")}
                </Text>
                <Text size="small" className="text-ui-fg-muted">
                  {change.from || "—"} → <span className="text-ui-fg-base">{change.to}</span>
                </Text>
                {!result.dry_run ? (
                  <Badge size="2xsmall" color="green">
                    Güncellendi
                  </Badge>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </Container>
  )
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
