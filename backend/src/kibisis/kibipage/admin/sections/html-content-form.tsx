import { Label, Text } from "@medusajs/ui"

import {
  emptyHtmlContent,
  HtmlContentSettings,
  SectionSettings,
} from "../../types"
import HtmlEditor from "../html-editor"

export type { HtmlContentSettings }

export function readHtmlContent(
  settings: SectionSettings | null | undefined
): HtmlContentSettings {
  if (!settings || typeof settings !== "object") {
    return emptyHtmlContent()
  }

  const html = typeof settings.html === "string" ? settings.html : ""
  return { html }
}

export default function HtmlContentForm({
  value,
  onChange,
}: {
  value: HtmlContentSettings
  onChange: (value: HtmlContentSettings) => void
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small">İçerik</Label>
      <HtmlEditor
        value={value.html}
        onChange={(html) => onChange({ ...value, html })}
      />
      <Text size="small" className="text-ui-fg-subtle">
        Görsel editörle yazın veya HTML sekmesinden ham kod düzenleyin. Boş
        bırakılırsa vitrinde bu bölüm gizlenir.
      </Text>
    </div>
  )
}
