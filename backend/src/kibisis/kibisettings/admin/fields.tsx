import { Button, Container, Heading, Input, Label, Select, Switch, Text, Textarea } from "@medusajs/ui"
import { ReactNode, useEffect, useState } from "react"

export type SecretState = {
  stored: boolean
  value: string | null
  onChange: (value: string | null) => void
}

export function FieldGroup({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{title}</Heading>
        {description && (
          <Text size="small" className="text-ui-fg-subtle">
            {description}
          </Text>
        )}
      </div>
      <div className="flex flex-col gap-y-4 px-6 py-4">{children}</div>
    </Container>
  )
}

function Hint({ children }: { children?: ReactNode }) {
  if (!children) {
    return null
  }

  return (
    <Text size="small" className="text-ui-fg-subtle">
      {children}
    </Text>
  )
}

export function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  multiline = false,
}: {
  id: string
  label: string
  hint?: ReactNode
  value: string
  onChange: (value: string) => void
  type?: "text" | "email" | "tel" | "time"
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <Label htmlFor={id} size="small">
        {label}
      </Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={4}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <Hint>{hint}</Hint>
    </div>
  )
}

export function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
}: {
  id: string
  label: string
  hint?: ReactNode
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft((current) => (Number(current.replace(",", ".")) === value ? current : String(value)))
  }, [value])

  return (
    <div className="flex flex-col gap-y-2">
      <Label htmlFor={id} size="small">
        {label}
      </Label>
      <div className="flex items-center gap-x-2">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(event) => {
            const text = event.target.value
            setDraft(text)
            const next = Number(text.replace(",", "."))
            if (text.trim() !== "" && Number.isFinite(next)) {
              onChange(next)
            }
          }}
          onBlur={() => {
            const next = Number(draft.replace(",", "."))
            const clamped = Number.isFinite(next)
              ? Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, next))
              : value
            const rounded = step >= 1 ? Math.trunc(clamped) : clamped
            setDraft(String(rounded))
            onChange(rounded)
          }}
        />
        {suffix && (
          <Text size="small" className="shrink-0 text-ui-fg-subtle">
            {suffix}
          </Text>
        )}
      </div>
      <Hint>{hint}</Hint>
    </div>
  )
}

export function SwitchField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-x-4">
      <div className="flex flex-col gap-y-1">
        <Label htmlFor={id} size="small">
          {label}
        </Label>
        <Hint>{hint}</Hint>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export function SelectField<T extends string>({
  id,
  label,
  hint,
  value,
  options,
  labels,
  onChange,
}: {
  id: string
  label: string
  hint?: ReactNode
  value: T
  options: readonly T[]
  labels: Record<T, string>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <Label htmlFor={id} size="small">
        {label}
      </Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <Select.Trigger id={id}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option} value={option}>
              {labels[option]}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
      <Hint>{hint}</Hint>
    </div>
  )
}

export function SecretField({
  id,
  label,
  hint,
  state,
}: {
  id: string
  label: string
  hint?: ReactNode
  state: SecretState
}) {
  const clearing = state.value === null

  return (
    <div className="flex flex-col gap-y-2">
      <Label htmlFor={id} size="small">
        {label}
      </Label>
      <div className="flex items-center gap-x-2">
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          value={state.value ?? ""}
          disabled={clearing}
          placeholder={
            clearing
              ? "Kaydedince silinecek"
              : state.stored
                ? "•••••••• kayıtlı, değiştirmek için yazın"
                : "Girilmedi"
          }
          onChange={(event) => state.onChange(event.target.value)}
        />
        {state.stored && (
          <Button
            type="button"
            size="small"
            variant="transparent"
            onClick={() => state.onChange(clearing ? "" : null)}
          >
            {clearing ? "Geri al" : "Kaldır"}
          </Button>
        )}
      </div>
      <Hint>{hint ?? "Kayıtlı değer güvenlik nedeniyle gösterilmez."}</Hint>
    </div>
  )
}
