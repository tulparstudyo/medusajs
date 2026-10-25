import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react"

import { api } from "./api"
import { SecretState } from "./fields"
import {
  SecretField,
  SETTINGS_DEFAULTS,
  SETTINGS_MENU,
  SettingsDTO,
  SettingsKey,
  SettingsValues,
} from "../types"

export type SettingsFormProps<K extends SettingsKey> = {
  values: SettingsValues[K]
  onChange: (patch: Partial<SettingsValues[K]>) => void
  secret: (field: SecretField<K>) => SecretState
}

type SecretDrafts = Record<string, string | null>

function draftOf(drafts: SecretDrafts, field: string): string | null {
  return field in drafts ? drafts[field] : ""
}

export default function SettingsScreen<K extends SettingsKey>({
  settingsKey,
  render,
}: {
  settingsKey: K
  render: (props: SettingsFormProps<K>) => ReactNode
}) {
  const menu = SETTINGS_MENU.find((item) => item.key === settingsKey)
  const [saved, setSaved] = useState<SettingsDTO<K> | null>(null)
  const [values, setValues] = useState<SettingsValues[K]>(SETTINGS_DEFAULTS[settingsKey])
  const [secretDrafts, setSecretDrafts] = useState<SecretDrafts>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((settings: SettingsDTO<K>) => {
    setSaved(settings)
    setValues(settings.values)
    setSecretDrafts({})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api<{ settings: SettingsDTO<K> }>(`/admin/kibisettings/${settingsKey}`)
      .then((body) => {
        if (!cancelled) {
          apply(body.settings)
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Ayarlar yüklenemedi.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [apply, settingsKey])

  const dirty = useMemo(() => {
    if (!saved) {
      return false
    }

    const secretChanged = Object.values(secretDrafts).some((value) => value !== "")
    return secretChanged || JSON.stringify(values) !== JSON.stringify(saved.values)
  }, [saved, secretDrafts, values])

  const onChange = useCallback((patch: Partial<SettingsValues[K]>) => {
    setValues((current) => ({ ...current, ...patch }))
  }, [])

  const secret = (field: SecretField<K>): SecretState => ({
    stored: !!saved?.secrets[field as string],
    value: draftOf(secretDrafts, field as string),
    onChange: (value) =>
      setSecretDrafts((current) => ({ ...current, [field as string]: value })),
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const body: Record<string, unknown> = { ...values }
    for (const field of Object.keys(saved?.secrets ?? {})) {
      body[field] = draftOf(secretDrafts, field)
    }

    try {
      const response = await api<{ settings: SettingsDTO<K> }>(
        `/admin/kibisettings/${settingsKey}`,
        { method: "POST", body: JSON.stringify(body) }
      )
      apply(response.settings)
      toast.success(`${menu?.label ?? "Ayarlar"} kaydedildi.`)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Ayarlar kaydedilemedi."
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    if (saved) {
      apply(saved)
      setError(null)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h1">{menu?.label ?? "Ayarlar"}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {menu?.description}
            {saved?.updated_at &&
              ` Son kayıt: ${new Date(saved.updated_at).toLocaleString("tr-TR")}.`}
          </Text>
        </div>
        {loading ? (
          <Text className="px-6 py-4" size="small">
            Yükleniyor
          </Text>
        ) : !saved ? (
          <Text className="px-6 py-4 text-ui-fg-error" size="small">
            {error ?? "Ayarlar yüklenemedi."}
          </Text>
        ) : null}
      </Container>
      {!loading && saved && (
        <>
          {render({ values, onChange, secret })}
          <Container className="flex flex-col gap-y-3 px-6 py-4">
            {error && (
              <Text size="small" className="text-ui-fg-error">
                {error}
              </Text>
            )}
            <div className="flex items-center gap-x-2">
              <Button type="submit" disabled={!dirty} isLoading={saving}>
                Kaydet
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!dirty || saving}
                onClick={reset}
              >
                Değişiklikleri geri al
              </Button>
            </div>
          </Container>
        </>
      )}
    </form>
  )
}
