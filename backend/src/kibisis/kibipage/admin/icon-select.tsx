import { Input, Popover } from "@medusajs/ui"
import { useMemo, useState } from "react"

import { SECTION_ICONS, sectionIconLabel } from "../types"
import { SectionIconMark } from "./section-icon"

export function IconSelect({
  value,
  onChange,
  allowEmpty = false,
}: {
  value: string
  onChange: (icon: string) => void
  allowEmpty?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = SECTION_ICONS.includes(value) ? value : ""
  const icons = useMemo(
    () =>
      [...SECTION_ICONS].sort((left, right) =>
        sectionIconLabel(left).localeCompare(sectionIconLabel(right), "tr")
      ),
    []
  )
  const needle = query.trim().toLocaleLowerCase("tr")
  const visible = needle
    ? icons.filter(
        (icon) =>
          sectionIconLabel(icon).toLocaleLowerCase("tr").includes(needle) ||
          icon.includes(needle)
      )
    : icons

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setQuery("")
        }
      }}
    >
      <Popover.Trigger
        type="button"
        className="bg-ui-bg-field shadow-buttons-neutral hover:bg-ui-bg-field-hover txt-compact-small flex h-8 w-full items-center justify-between gap-x-2 rounded-md px-2 text-left outline-none"
      >
        <span className="flex min-w-0 items-center gap-x-2">
          {selected ? <SectionIconMark name={selected} /> : null}
          <span className="truncate">{selected ? sectionIconLabel(selected) : "Yok"}</span>
        </span>
        <SectionIconMark name="chevron-up-down" className="text-ui-fg-muted h-4 w-4" />
      </Popover.Trigger>
      <Popover.Content align="start" className="w-[336px] p-2">
        <Input
          autoFocus
          value={query}
          placeholder="İkon ara"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
            }
          }}
        />
        {allowEmpty ? (
          <button
            type="button"
            className="hover:bg-ui-bg-base-hover mt-2 flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
          >
            Yok
          </button>
        ) : null}
        {visible.length === 0 ? (
          <p className="text-ui-fg-subtle px-2 py-3 text-xs">Eşleşen ikon yok.</p>
        ) : (
          <div className="mt-2 grid max-h-64 grid-cols-8 gap-1 overflow-y-auto">
            {visible.map((icon) => (
              <button
                key={icon}
                type="button"
                title={sectionIconLabel(icon)}
                aria-label={sectionIconLabel(icon)}
                className={`flex h-8 w-8 items-center justify-center rounded-md ${
                  icon === selected
                    ? "bg-ui-bg-base-pressed text-ui-fg-interactive"
                    : "hover:bg-ui-bg-base-hover"
                }`}
                onClick={() => {
                  onChange(icon)
                  setOpen(false)
                }}
              >
                <SectionIconMark name={icon} />
              </button>
            ))}
          </div>
        )}
      </Popover.Content>
    </Popover>
  )
}
