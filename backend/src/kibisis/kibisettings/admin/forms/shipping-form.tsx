import { Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

import { useCarrierCatalog } from "../carrier-catalog"
import { FieldGroup, NumberField, SelectField, TextField } from "../fields"
import { SettingsFormProps } from "../settings-screen"

export default function ShippingForm({ values, onChange }: SettingsFormProps<"shipping">) {
  const { catalog, error } = useCarrierCatalog()
  const carriers = catalog?.installed ?? []
  const labels: Record<string, string> = {}

  for (const carrier of carriers) {
    labels[carrier.id] = carrier.label
  }

  const options = carriers.map((carrier) => carrier.id)
  if (values.default_carrier && !(values.default_carrier in labels)) {
    options.push(values.default_carrier)
    labels[values.default_carrier] = `${values.default_carrier} (paket kurulu değil)`
  }

  const carriersLink = (
    <Link to="/kibisettings/carriers" className="text-ui-fg-interactive hover:underline">
      Kargo Firmaları
    </Link>
  )

  return (
    <>
      <FieldGroup title="Kargo firması">
        {options.length ? (
          <SelectField
            id="shipping-default-carrier"
            label="Varsayılan kargo firması"
            value={values.default_carrier}
            options={options}
            labels={labels}
            hint={<>Firmaların entegrasyon ve takip bilgileri {carriersLink} sayfasında.</>}
            onChange={(default_carrier) => onChange({ default_carrier })}
          />
        ) : (
          <Text size="small" className={error ? "text-ui-fg-error" : "text-ui-fg-subtle"}>
            {error ?? (catalog ? <>Kurulu kargo firması paketi yok. Kurulum için {carriersLink} sayfasına bakın.</> : "Kargo paketleri yükleniyor")}
          </Text>
        )}
      </FieldGroup>
      <FieldGroup title="Ücretler">
        <NumberField
          id="shipping-flat-rate"
          label="Sabit kargo ücreti"
          suffix="TL"
          step={0.01}
          value={values.flat_rate}
          onChange={(flat_rate) => onChange({ flat_rate })}
        />
        <NumberField
          id="shipping-free-threshold"
          label="Ücretsiz kargo alt limiti"
          suffix="TL"
          step={0.01}
          hint="0 girilirse ücretsiz kargo uygulanmaz."
          value={values.free_shipping_threshold}
          onChange={(free_shipping_threshold) => onChange({ free_shipping_threshold })}
        />
      </FieldGroup>
      <FieldGroup title="Gönderim süresi">
        <NumberField
          id="shipping-dispatch-days"
          label="Kargoya teslim süresi"
          suffix="iş günü"
          max={30}
          value={values.dispatch_days}
          onChange={(dispatch_days) => onChange({ dispatch_days })}
        />
        <TextField
          id="shipping-cutoff"
          label="Aynı gün kargo son saati"
          type="time"
          hint="Bu saatten önce verilen siparişler aynı gün kargolanır. Boş bırakılabilir."
          value={values.cutoff_time}
          onChange={(cutoff_time) => onChange({ cutoff_time })}
        />
      </FieldGroup>
      <FieldGroup title="Gönderici bilgileri" description="Kargo etiketinde gönderici olarak basılır.">
        <TextField
          id="shipping-sender-name"
          label="Gönderici adı"
          value={values.sender_name}
          onChange={(sender_name) => onChange({ sender_name })}
        />
        <TextField
          id="shipping-sender-phone"
          label="Gönderici telefonu"
          type="tel"
          value={values.sender_phone}
          onChange={(sender_phone) => onChange({ sender_phone })}
        />
        <TextField
          id="shipping-sender-address"
          label="Gönderici adresi"
          multiline
          value={values.sender_address}
          onChange={(sender_address) => onChange({ sender_address })}
        />
      </FieldGroup>
    </>
  )
}
