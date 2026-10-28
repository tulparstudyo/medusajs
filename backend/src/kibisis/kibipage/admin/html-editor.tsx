import { Button, Textarea } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"

type Mode = "visual" | "source"

function run(command: string, value?: string) {
  document.execCommand(command, false, value)
}

export default function HtmlEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const surface = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>("visual")
  const [source, setSource] = useState(value)
  const syncing = useRef(false)

  useEffect(() => {
    if (mode === "source") {
      setSource(value)
      return
    }

    const node = surface.current
    if (!node || syncing.current) {
      return
    }

    if (node.innerHTML !== value) {
      node.innerHTML = value || ""
    }
  }, [value, mode])

  const emitFromVisual = () => {
    const node = surface.current
    if (!node) {
      return
    }

    syncing.current = true
    onChange(node.innerHTML)
    queueMicrotask(() => {
      syncing.current = false
    })
  }

  const switchMode = (next: Mode) => {
    if (next === mode) {
      return
    }

    if (next === "source") {
      const html = surface.current?.innerHTML ?? value
      setSource(html)
      onChange(html)
      setMode("source")
      return
    }

    onChange(source)
    setMode("visual")
  }

  const wrapLink = () => {
    const href = window.prompt("Bağlantı adresi", "https://")
    if (!href) {
      return
    }
    run("createLink", href)
    emitFromVisual()
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ui-border-base">
      <div className="flex flex-wrap items-center gap-1 border-b border-ui-border-base bg-ui-bg-subtle px-2 py-1.5">
        <Button
          type="button"
          size="small"
          variant={mode === "visual" ? "primary" : "secondary"}
          onClick={() => switchMode("visual")}
        >
          Görsel
        </Button>
        <Button
          type="button"
          size="small"
          variant={mode === "source" ? "primary" : "secondary"}
          onClick={() => switchMode("source")}
        >
          HTML
        </Button>
        <span className="mx-1 h-4 w-px bg-ui-border-base" />
        {mode === "visual" ? (
          <>
            <Button type="button" size="small" variant="secondary" onClick={() => { run("bold"); emitFromVisual() }}>
              Kalın
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => { run("italic"); emitFromVisual() }}>
              İtalik
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => { run("underline"); emitFromVisual() }}>
              Altı çizili
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => { run("formatBlock", "h2"); emitFromVisual() }}>
              H2
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => { run("formatBlock", "h3"); emitFromVisual() }}>
              H3
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => { run("formatBlock", "p"); emitFromVisual() }}>
              Paragraf
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => { run("insertUnorderedList"); emitFromVisual() }}>
              Liste
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => { run("insertOrderedList"); emitFromVisual() }}>
              Numara
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={wrapLink}>
              Bağlantı
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => { run("removeFormat"); emitFromVisual() }}>
              Temizle
            </Button>
          </>
        ) : null}
      </div>
      {mode === "visual" ? (
        <div
          ref={surface}
          className="min-h-48 max-h-[28rem] overflow-y-auto px-3 py-2 text-sm outline-none prose prose-sm max-w-none"
          contentEditable
          suppressContentEditableWarning
          onInput={emitFromVisual}
          onBlur={emitFromVisual}
        />
      ) : (
        <Textarea
          value={source}
          onChange={(event) => {
            setSource(event.target.value)
            onChange(event.target.value)
          }}
          rows={14}
          className="rounded-none border-0 font-mono text-xs"
        />
      )}
    </div>
  )
}
