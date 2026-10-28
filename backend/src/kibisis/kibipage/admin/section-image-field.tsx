import { Button, Label, Text, toast } from "@medusajs/ui"
import { ChangeEvent, useRef, useState } from "react"

import { api } from "./api"

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error("Dosya okunamadı."))
    reader.readAsDataURL(file)
  })
}

export default function SectionImageField({
  sectionId,
  label = "Görsel",
  value,
  onChange,
}: {
  sectionId: string
  label?: string
  value: string
  onChange: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const preview = value.trim()
  const isImage =
    /^https?:\/\//i.test(preview) ||
    preview.startsWith("/") ||
    /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(preview)

  const pick = () => {
    inputRef.current?.click()
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Yalnızca görsel dosyası seçin.")
      return
    }

    setUploading(true)
    try {
      const content = await fileToBase64(file)
      const response = await api<{ file: { url: string } }>(
        `/admin/kibipage/sections/${sectionId}/files`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type,
            content,
          }),
        }
      )
      onChange(response.file.url)
      toast.success("Görsel yüklendi.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görsel yüklenemedi.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small">{label}</Label>
      <div className="flex items-start gap-x-3">
        <div className="bg-ui-bg-subtle border-ui-border-base flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border">
          {isImage ? (
            <img src={preview} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <Text size="small" className="text-ui-fg-muted px-1 text-center">
              —
            </Text>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-y-2">
          <div className="flex flex-wrap gap-x-2 gap-y-2">
            <Button
              type="button"
              size="small"
              variant="secondary"
              isLoading={uploading}
              onClick={pick}
            >
              Dosya seç
            </Button>
            {preview ? (
              <Button
                type="button"
                size="small"
                variant="danger"
                disabled={uploading}
                onClick={() => onChange("")}
              >
                Kaldır
              </Button>
            ) : null}
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            JPG, PNG, WebP, GIF, AVIF veya SVG · en fazla 2 MB
          </Text>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
        className="hidden"
        onChange={(event) => void onFile(event)}
      />
    </div>
  )
}
