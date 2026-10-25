import { Badge, Button, Container, Tabs, Text } from "@medusajs/ui"
import { useCallback, useState } from "react"

import { useCarrierCatalog, useCarrierInstaller } from "../carrier-catalog"
import { FieldGroup, SecretField, SwitchField, TextField } from "../fields"
import { SettingsFormProps } from "../settings-screen"
import { carrierField } from "../../types"
import {
  CarrierCatalogDTO,
  CarrierInstallDTO,
  InstalledCarrierDTO,
} from "../../../kibicarrier/types"

type Installer = ReturnType<typeof useCarrierInstaller>

export default function CarriersForm(props: SettingsFormProps<"carriers">) {
  const { catalog, error, reload } = useCarrierCatalog()
  const [tab, setTab] = useState("")
  const installer = useCarrierInstaller(
    useCallback(
      (installation: CarrierInstallDTO) => {
        setTab(installation.id)
        reload()
      },
      [reload]
    )
  )

  if (!catalog) {
    return (
      <Container className="px-6 py-4">
        <Text size="small" className={error ? "text-ui-fg-error" : undefined}>
          {error ?? "Kargo paketleri yükleniyor"}
        </Text>
      </Container>
    )
  }

  const { installed } = catalog
  const active = installed.some((carrier) => carrier.id === tab) ? tab : (installed[0]?.id ?? "")

  return (
    <>
      {catalog.errors.length > 0 && (
        <FieldGroup
          title="Yüklenemeyen paketler"
          description="Bu paketler kurulu ama kargo tanımı okunamadı."
        >
          {catalog.errors.map((item) => (
            <Text key={item.id} size="small" className="text-ui-fg-error">
              {item.message}
            </Text>
          ))}
        </FieldGroup>
      )}
      {installed.length ? (
        <Tabs value={active} onValueChange={setTab} className="flex flex-col gap-y-3">
          <Container className="px-6 py-4">
            <Tabs.List>
              {installed.map((carrier) => (
                <Tabs.Trigger key={carrier.id} value={carrier.id} className="gap-x-2">
                  {carrier.label}
                  {!carrier.license.valid ? (
                    <Badge size="2xsmall" color="red">
                      Lisans
                    </Badge>
                  ) : (
                    props.values[carrierField(carrier.id, "enabled")] === true && (
                      <Badge size="2xsmall" color="green">
                        Aktif
                      </Badge>
                    )
                  )}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Container>
          {installed.map((carrier) => (
            <Tabs.Content key={carrier.id} value={carrier.id} className="flex flex-col gap-y-3">
              <CarrierPanel
                carrier={carrier}
                installer={installer}
                installEnabled={catalog.install_enabled}
                {...props}
              />
            </Tabs.Content>
          ))}
        </Tabs>
      ) : (
        <FieldGroup
          title="Kurulu kargo firması yok"
          description="Kargo entegrasyonları lisanslı paketler olarak satılır. Lisansınız olan firmayı aşağıdan kurun."
        >
          <Text size="small" className="text-ui-fg-subtle">
            Kurulan firma hemen burada sekme olarak açılır; yeniden başlatma gerekmez.
          </Text>
        </FieldGroup>
      )}
      <Marketplace catalog={catalog} installer={installer} />
    </>
  )
}

function CarrierPanel({
  carrier,
  installer,
  installEnabled,
  values,
  onChange,
  secret,
}: SettingsFormProps<"carriers"> & {
  carrier: InstalledCarrierDTO
  installer: Installer
  installEnabled: boolean
}) {
  const field = (name: string) => carrierField(carrier.id, name)
  const id = (name: string) => `carrier-${carrier.id}-${name}`
  const set = (name: string, value: string | boolean) => onChange({ [field(name)]: value })
  const text = (name: string) => {
    const value = values[field(name)]
    return typeof value === "string" ? value : ""
  }
  const enabled = values[field("enabled")] === true

  return (
    <>
      <FieldGroup
        title={carrier.label}
        description={carrier.description ?? `${carrier.label} ile gönderim ve entegrasyon ayarları.`}
      >
        <LicenseStatus carrier={carrier} installer={installer} installEnabled={installEnabled} />
        <SwitchField
          id={id("enabled")}
          label={`${carrier.label} kullanılsın`}
          hint={
            carrier.license.valid
              ? "Kapalıyken bu firma siparişlerde seçilemez."
              : "Lisans geçerli olmadan bu firmayla gönderi oluşturulamaz."
          }
          checked={enabled}
          onChange={(value) => set("enabled", value)}
        />
        {enabled && (
          <SwitchField
            id={id("test_mode")}
            label="Test ortamı"
            hint="Açıkken gönderiler firmanın test servisine iletilir."
            checked={values[field("test_mode")] !== false}
            onChange={(value) => set("test_mode", value)}
          />
        )}
      </FieldGroup>
      {enabled && (
        <>
          <FieldGroup
            title="Entegrasyon bilgileri"
            description={`${carrier.label} tarafından verilen web servis bilgileri.`}
          >
            {carrier.credentials.map((credential) =>
              credential.secret ? (
                <SecretField
                  key={credential.key}
                  id={id(credential.key)}
                  label={credential.label}
                  hint={credential.hint ?? undefined}
                  state={secret(field(credential.key))}
                />
              ) : (
                <TextField
                  key={credential.key}
                  id={id(credential.key)}
                  label={credential.label}
                  hint={credential.hint ?? undefined}
                  placeholder={credential.placeholder ?? undefined}
                  value={text(credential.key)}
                  onChange={(value) => set(credential.key, value)}
                />
              )
            )}
          </FieldGroup>
          <FieldGroup title="Gönderi takibi">
            <TextField
              id={id("tracking_url")}
              label="Takip adresi"
              placeholder={carrier.tracking_url}
              hint="{code} yerine gönderinin takip numarası yazılır. Boşsa paketin varsayılanı kullanılır."
              value={text("tracking_url")}
              onChange={(value) => set("tracking_url", value)}
            />
          </FieldGroup>
        </>
      )}
    </>
  )
}

function LicenseStatus({
  carrier,
  installer,
  installEnabled,
}: {
  carrier: InstalledCarrierDTO
  installer: Installer
  installEnabled: boolean
}) {
  const { license } = carrier
  const expires = license.expires_at
    ? new Date(license.expires_at).toLocaleDateString("tr-TR")
    : "süresiz"
  const source = [carrier.repo, carrier.ref, carrier.commit.slice(0, 7), `v${carrier.version}`]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex items-start justify-between gap-x-4">
      <div className="flex flex-col gap-y-1">
        <div className="flex items-center gap-x-2">
          <Badge size="2xsmall" color={license.valid ? "green" : "red"}>
            {license.valid ? "Lisanslı" : "Lisans geçersiz"}
          </Badge>
          <Text size="small" className="text-ui-fg-subtle">
            {source}
          </Text>
        </div>
        <Text size="small" className={license.valid ? "text-ui-fg-subtle" : "text-ui-fg-error"}>
          {license.valid
            ? [license.customer, `lisans ${expires}`].filter(Boolean).join(", ")
            : license.reason}
          {license.valid && license.reason ? ` ${license.reason}` : ""}
        </Text>
      </div>
      {installEnabled && (
        <Button
          type="button"
          size="small"
          variant="secondary"
          isLoading={installer.installing === carrier.repo}
          disabled={!!installer.installing}
          onClick={() => void installer.install(carrier.repo, carrier.label)}
        >
          Güncelle
        </Button>
      )}
    </div>
  )
}

function Marketplace({ catalog, installer }: { catalog: CarrierCatalogDTO; installer: Installer }) {
  if (!catalog.available.length) {
    return null
  }

  return (
    <FieldGroup
      title="Kargo firması paketleri"
      description={`Lisanslı paketler ${catalog.domain} domaini doğrulanarak lisans sunucusundan kurulur.`}
    >
      <div className="flex flex-col divide-y">
        {catalog.available.map((item) => (
          <div key={item.repo} className="flex items-center justify-between gap-x-4 py-2">
            <div className="flex flex-col">
              <Text size="small" weight="plus">
                {item.label}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {item.repo}
              </Text>
            </div>
            <div className="flex items-center gap-x-2">
              <Badge size="2xsmall" color={item.status === "available" ? "blue" : "grey"}>
                {item.status === "available" ? "Satın alınabilir" : "Yakında"}
              </Badge>
              {item.status === "available" && (
                <>
                  {catalog.store_url && (
                    <a
                      href={catalog.store_url}
                      target="_blank"
                      rel="noreferrer"
                      className="txt-compact-small text-ui-fg-interactive hover:underline"
                    >
                      Satın al
                    </a>
                  )}
                  <Button
                    type="button"
                    size="small"
                    isLoading={installer.installing === item.repo}
                    disabled={!catalog.install_enabled || !!installer.installing}
                    onClick={() => void installer.install(item.repo, item.label)}
                  >
                    Kur
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {!catalog.install_enabled && (
        <Text size="small" className="text-ui-fg-error">
          Kurulum için backend .env dosyasında KIBISIS_LICENSE_SERVER_URL tanımlanmalı.
        </Text>
      )}
    </FieldGroup>
  )
}
