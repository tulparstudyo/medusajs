import { Badge, Button, Container, Tabs, Text } from "@medusajs/ui"
import { useCallback, useState } from "react"

import { usePaymentCatalog, usePaymentInstaller } from "../payment-catalog"
import { FieldGroup, NumberField, SecretField, SwitchField, TextField } from "../fields"
import { SettingsFormProps } from "../settings-screen"
import { paymentField } from "../../types"
import {
  InstalledPaymentProviderDTO,
  PaymentCatalogDTO,
  PaymentInstallDTO,
} from "../../../kibipayment/types"

type Installer = ReturnType<typeof usePaymentInstaller>

export default function PaymentForm(props: SettingsFormProps<"payment">) {
  const { catalog, error, reload } = usePaymentCatalog()
  const [tab, setTab] = useState("general")
  const installer = usePaymentInstaller(
    useCallback(
      (installation: PaymentInstallDTO) => {
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
          {error ?? "Ödeme paketleri yükleniyor..."}
        </Text>
      </Container>
    )
  }

  const { installed } = catalog
  const tabValues = ["general", ...installed.map((p) => p.id)]
  const active = tabValues.includes(tab) ? tab : "general"

  return (
    <>
      {catalog.errors.length > 0 && (
        <FieldGroup
          title="Yüklenemeyen paketler"
          description="Bu paketler kurulu ama ödeme tanımı okunamadı."
        >
          {catalog.errors.map((item) => (
            <Text key={item.id} size="small" className="text-ui-fg-error">
              {item.message}
            </Text>
          ))}
        </FieldGroup>
      )}

      <Tabs value={active} onValueChange={setTab} className="flex flex-col gap-y-3">
        <Container className="px-6 py-4">
          <Tabs.List>
            <Tabs.Trigger value="general" className="gap-x-2">
              Havale & Kapıda Ödeme
            </Tabs.Trigger>
            {installed.map((provider) => (
              <Tabs.Trigger key={provider.id} value={provider.id} className="gap-x-2">
                {provider.label}
                {!provider.license.valid ? (
                  <Badge size="2xsmall" color="red">
                    Lisans
                  </Badge>
                ) : !provider.licensed ? (
                  <Badge size="2xsmall" color="purple">
                    Ücretsiz
                  </Badge>
                ) : (
                  props.values[paymentField(provider.id, "enabled")] === true && (
                    <Badge size="2xsmall" color="green">
                      Aktif
                    </Badge>
                  )
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Container>

        <Tabs.Content value="general" className="flex flex-col gap-y-3">
          <GeneralPaymentPanel {...props} />
        </Tabs.Content>

        {installed.map((provider) => (
          <Tabs.Content key={provider.id} value={provider.id} className="flex flex-col gap-y-3">
            <PaymentProviderPanel
              provider={provider}
              installer={installer}
              installEnabled={catalog.install_enabled}
              {...props}
            />
          </Tabs.Content>
        ))}
      </Tabs>

      <PaymentMarketplace catalog={catalog} installer={installer} />
    </>
  )
}

function GeneralPaymentPanel({
  values,
  onChange,
}: SettingsFormProps<"payment">) {
  return (
    <>
      <FieldGroup title="Havale / EFT" description="Banka hesapları ve indirim oranı.">
        <SwitchField
          id="payment-bank-transfer"
          label="Havale / EFT ile ödeme"
          checked={values.bank_transfer_enabled === true}
          onChange={(bank_transfer_enabled) => onChange({ bank_transfer_enabled })}
        />
        {values.bank_transfer_enabled && (
          <>
            <TextField
              id="payment-bank-info"
              label="Hesap bilgileri"
              multiline
              placeholder={"Banka adı\nAlıcı adı\nTR00 0000 0000 0000 0000 0000 00"}
              hint="Sipariş onayında müşteriye gösterilir."
              value={typeof values.bank_transfer_info === "string" ? values.bank_transfer_info : ""}
              onChange={(bank_transfer_info) => onChange({ bank_transfer_info })}
            />
            <NumberField
              id="payment-bank-discount"
              label="Havale indirimi"
              suffix="%"
              step={0.1}
              max={50}
              value={typeof values.bank_transfer_discount === "number" ? values.bank_transfer_discount : 0}
              onChange={(bank_transfer_discount) => onChange({ bank_transfer_discount })}
            />
          </>
        )}
      </FieldGroup>

      <FieldGroup title="Kapıda Ödeme" description="Teslimatta nakit veya POS ile tahsilat.">
        <SwitchField
          id="payment-cod"
          label="Kapıda ödeme"
          checked={values.cod_enabled === true}
          onChange={(cod_enabled) => onChange({ cod_enabled })}
        />
        {values.cod_enabled && (
          <NumberField
            id="payment-cod-fee"
            label="Kapıda ödeme hizmet bedeli"
            suffix="TL"
            step={0.01}
            value={typeof values.cod_fee === "number" ? values.cod_fee : 0}
            onChange={(cod_fee) => onChange({ cod_fee })}
          />
        )}
      </FieldGroup>
    </>
  )
}

function PaymentProviderPanel({
  provider,
  installer,
  installEnabled,
  values,
  onChange,
  secret,
}: SettingsFormProps<"payment"> & {
  provider: InstalledPaymentProviderDTO
  installer: Installer
  installEnabled: boolean
}) {
  const field = (name: string) => paymentField(provider.id, name)
  const id = (name: string) => `payment-${provider.id}-${name}`
  const set = (name: string, value: string | boolean | number) => onChange({ [field(name)]: value })
  const text = (name: string) => {
    const value = values[field(name)]
    return typeof value === "string" ? value : ""
  }
  const enabled = values[field("enabled")] === true

  return (
    <>
      <FieldGroup
        title={provider.label}
        description={provider.description ?? `${provider.label} sanal POS entegrasyonu.`}
      >
        <LicenseStatus provider={provider} installer={installer} installEnabled={installEnabled} />
        <SwitchField
          id={id("enabled")}
          label={`${provider.label} ile ödeme aktif`}
          hint={
            provider.license.valid
              ? "Açıkken vitrinde müşterilere kredi/banka kartı seçeneği olarak sunulur."
              : "Lisans geçerli olmadan bu ödeme yöntemi kullanılamaz."
          }
          checked={enabled}
          onChange={(value) => set("enabled", value)}
        />
        {enabled && (
          <SwitchField
            id={id("test_mode")}
            label="Test (Sandbox) ortamı"
            hint="Gerçek tahsilat yapmadan önce test kartlarıyla denemek için açık tutun."
            checked={values[field("test_mode")] !== false}
            onChange={(value) => set("test_mode", value)}
          />
        )}
      </FieldGroup>

      {enabled && (
        <>
          <FieldGroup
            title="Entegrasyon bilgileri"
            description={`${provider.label} tarafından verilen mağaza ve API anahtarları.`}
          >
            {provider.credentials.map((credential) =>
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

          {provider.supports_installments && (
            <FieldGroup title="Taksit seçenekleri">
              <SwitchField
                id={id("installments_enabled")}
                label="Taksitli ödeme"
                hint="Müşterilerinize kredi kartına taksit imkanı tanır."
                checked={values[field("installments_enabled")] === true}
                onChange={(value) => set("installments_enabled", value)}
              />
              {values[field("installments_enabled")] === true && (
                <NumberField
                  id={id("max_installments")}
                  label="En fazla taksit sayısı"
                  min={1}
                  max={12}
                  value={typeof values[field("max_installments")] === "number" ? (values[field("max_installments")] as number) : 6}
                  onChange={(value) => set("max_installments", value)}
                />
              )}
            </FieldGroup>
          )}
        </>
      )}
    </>
  )
}

function LicenseStatus({
  provider,
  installer,
  installEnabled,
}: {
  provider: InstalledPaymentProviderDTO
  installer: Installer
  installEnabled: boolean
}) {
  const { license, licensed } = provider
  const expires = license.expires_at
    ? new Date(license.expires_at).toLocaleDateString("tr-TR")
    : "süresiz"
  const source = [provider.repo, provider.ref, provider.commit.slice(0, 7), `v${provider.version}`]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex items-start justify-between gap-x-4">
      <div className="flex flex-col gap-y-1">
        <div className="flex items-center gap-x-2">
          {!licensed ? (
            <Badge size="2xsmall" color="purple">
              Ücretsiz / Lisanssız
            </Badge>
          ) : (
            <Badge size="2xsmall" color={license.valid ? "green" : "red"}>
              {license.valid ? "Lisanslı" : "Lisans geçersiz"}
            </Badge>
          )}
          <Text size="small" className="text-ui-fg-subtle">
            {source}
          </Text>
        </div>
        <Text size="small" className={license.valid ? "text-ui-fg-subtle" : "text-ui-fg-error"}>
          {licensed
            ? license.valid
              ? [license.customer, `lisans ${expires}`].filter(Boolean).join(", ")
              : license.reason
            : "Bu paket açık kaynak / ücretsiz lisanslıdır; etki alanı kısıtlaması yoktur."}
        </Text>
      </div>
      {installEnabled && (
        <Button
          type="button"
          size="small"
          variant="secondary"
          isLoading={installer.installing === provider.repo}
          disabled={!!installer.installing}
          onClick={() => void installer.install(provider.repo, provider.label)}
        >
          Güncelle
        </Button>
      )}
    </div>
  )
}

function PaymentMarketplace({
  catalog,
  installer,
}: {
  catalog: PaymentCatalogDTO
  installer: Installer
}) {
  if (!catalog.available.length) {
    return null
  }

  return (
    <FieldGroup
      title="Ödeme kuruluşu paketleri"
      description={`Ödeme sağlayıcı paketleri ${catalog.domain} üzerinden kurulur.`}
    >
      <div className="flex flex-col divide-y">
        {catalog.available.map((item) => (
          <div key={item.repo} className="flex items-center justify-between gap-x-4 py-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-x-2">
                <Text size="small" weight="plus">
                  {item.label}
                </Text>
                {!item.licensed && (
                  <Badge size="2xsmall" color="purple">
                    Ücretsiz
                  </Badge>
                )}
              </div>
              <Text size="small" className="text-ui-fg-subtle">
                {item.repo}
              </Text>
            </div>
            <div className="flex items-center gap-x-2">
              {item.status === "available" ? (
                <>
                  {item.licensed ? (
                    <Badge size="2xsmall" color="blue">
                      Lisanslı
                    </Badge>
                  ) : (
                    <Badge size="2xsmall" color="green">
                      Hemen Kurulabilir
                    </Badge>
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
              ) : (
                <Badge size="2xsmall" color="grey">
                  Yakında
                </Badge>
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
