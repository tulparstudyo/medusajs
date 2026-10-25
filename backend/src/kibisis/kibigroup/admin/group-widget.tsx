import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { FormEvent, useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { AdminGroupItem, AdminGroupResponse, GroupCode } from "../types"
import { api } from "./api"

type Draft = {
  main_code: string
  color: string
  color_hex: string
  position: string
}

const EMPTY: Draft = { main_code: "", color: "", color_hex: "", position: "0" }

const STATUS_LABELS: Record<string, string> = {
  published: "Yayında",
  draft: "Taslak",
  proposed: "Önerildi",
  rejected: "Reddedildi",
}

function draftOf(response: AdminGroupResponse): Draft {
  if (!response.group) {
    return EMPTY
  }

  return {
    main_code: response.group.main_code,
    color: response.group.color,
    color_hex: response.group.color_hex ?? "",
    position: String(response.group.position),
  }
}

export default function GroupWidget({ data: product }: DetailWidgetProps<AdminProduct>) {
  const path = `/admin/kibigroup/products/${product.id}`
  const [items, setItems] = useState<AdminGroupItem[]>([])
  const [assigned, setAssigned] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [codes, setCodes] = useState<GroupCode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const apply = useCallback((response: AdminGroupResponse) => {
    setItems(response.items)
    setAssigned(Boolean(response.group))
    setDraft(draftOf(response))
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    api<AdminGroupResponse>(path)
      .then((response) => active && apply(response))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Renk grubu yüklenemedi."))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [apply, path])

  useEffect(() => {
    const term = draft.main_code.trim()
    const timer = setTimeout(() => {
      api<{ codes: GroupCode[] }>(`/admin/kibigroup/codes?q=${encodeURIComponent(term)}`)
        .then((response) => setCodes(response.codes))
        .catch(() => setCodes([]))
    }, 250)

    return () => clearTimeout(timer)
  }, [draft.main_code])

  const update = (field: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }))

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const position = Number(draft.position || 0)

    if (!Number.isInteger(position) || position < 0 || position > 999) {
      toast.error("Sıra 0 ile 999 arasında bir tam sayı olmalı.")
      return
    }

    setSaving(true)
    try {
      const response = await api<AdminGroupResponse>(path, {
        method: "POST",
        body: JSON.stringify({
          main_code: draft.main_code,
          color: draft.color,
          color_hex: draft.color_hex,
          position,
        }),
      })
      apply(response)
      toast.success("Renk grubu kaydedildi.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Renk grubu kaydedilemedi.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    try {
      apply(await api<AdminGroupResponse>(path, { method: "DELETE" }))
      toast.success("Ürün renk grubundan çıkarıldı.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ürün gruptan çıkarılamadı.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Renk grubu</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Aynı ana koda sahip ürünler, ürün sayfasında renk seçenekleri olarak birbirine bağlanır.
        </Text>
      </div>
      {loading ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Yükleniyor...
          </Text>
        </div>
      ) : (
        <form onSubmit={(event) => void save(event)} className="flex flex-col gap-y-3 px-6 py-4">
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="kibigroup-code" size="small">
              Ana kod
            </Label>
            <Input
              id="kibigroup-code"
              list="kibigroup-codes"
              autoComplete="off"
              placeholder="Örn. ty-878852321"
              value={draft.main_code}
              onChange={(event) => update("main_code", event.target.value)}
            />
            <datalist id="kibigroup-codes">
              {codes.map((code) => (
                <option key={code.main_code} value={code.main_code}>
                  {`${code.count} ürün`}
                </option>
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="kibigroup-color" size="small">
              Renk adı
            </Label>
            <Input
              id="kibigroup-color"
              placeholder="Örn. Beyaz"
              value={draft.color}
              onChange={(event) => update("color", event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="kibigroup-hex" size="small">
                Renk kodu
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Renk seç"
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border border-ui-border-base bg-transparent"
                  value={draft.color_hex || "#ffffff"}
                  onChange={(event) => update("color_hex", event.target.value)}
                />
                <Input
                  id="kibigroup-hex"
                  placeholder="#FFFFFF"
                  value={draft.color_hex}
                  onChange={(event) => update("color_hex", event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="kibigroup-position" size="small">
                Sıra
              </Label>
              <Input
                id="kibigroup-position"
                type="number"
                min={0}
                max={999}
                value={draft.position}
                onChange={(event) => update("position", event.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {assigned ? (
              <Button
                type="button"
                size="small"
                variant="secondary"
                disabled={saving}
                onClick={() => void remove()}
              >
                Gruptan çıkar
              </Button>
            ) : null}
            <Button type="submit" size="small" isLoading={saving}>
              Kaydet
            </Button>
          </div>
        </form>
      )}
      {items.length ? (
        <div className="flex flex-col gap-y-2 px-6 py-4">
          <Text size="small" weight="plus">
            Gruptaki ürünler ({items.length})
          </Text>
          {items.map((item) => (
            <Link
              key={item.product_id}
              to={`/products/${item.product_id}`}
              className="flex items-center gap-3 rounded-lg border border-ui-border-base px-2 py-1.5 hover:bg-ui-bg-base-hover"
            >
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" className="h-10 w-8 shrink-0 rounded object-cover" />
              ) : (
                <span className="h-10 w-8 shrink-0 rounded bg-ui-bg-component" />
              )}
              <span className="min-w-0 flex-1">
                <Text size="small" weight="plus" className="flex items-center gap-1.5">
                  {item.color_hex ? (
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-ui-border-base"
                      style={{ backgroundColor: item.color_hex }}
                    />
                  ) : null}
                  {item.color}
                  {item.product_id === product.id ? " (bu ürün)" : ""}
                </Text>
                <Text size="xsmall" className="truncate text-ui-fg-subtle">
                  {item.title}
                </Text>
              </span>
              <Badge size="2xsmall" color={item.status === "published" ? "green" : "grey"}>
                {STATUS_LABELS[item.status] ?? item.status}
              </Badge>
            </Link>
          ))}
        </div>
      ) : null}
    </Container>
  )
}
