import { FieldGroup, SwitchField, TextField } from "../fields"
import { SettingsFormProps } from "../settings-screen"

export default function StoreForm({ values, onChange }: SettingsFormProps<"store">) {
  return (
    <>
      <FieldGroup title="Genel" description="Vitrinde ve e-postalarda görünen mağaza bilgileri.">
        <TextField
          id="store-name"
          label="Mağaza adı"
          value={values.store_name}
          onChange={(store_name) => onChange({ store_name })}
        />
        <TextField
          id="store-email"
          label="İletişim e-postası"
          type="email"
          placeholder="destek@ornek.com"
          value={values.email}
          onChange={(email) => onChange({ email })}
        />
        <TextField
          id="store-phone"
          label="Telefon"
          type="tel"
          placeholder="0850 000 00 00"
          value={values.phone}
          onChange={(phone) => onChange({ phone })}
        />
        <TextField
          id="store-whatsapp"
          label="WhatsApp"
          type="tel"
          placeholder="905xx xxx xx xx"
          value={values.whatsapp}
          onChange={(whatsapp) => onChange({ whatsapp })}
        />
        <TextField
          id="store-address"
          label="Adres"
          multiline
          value={values.address}
          onChange={(address) => onChange({ address })}
        />
      </FieldGroup>
      <FieldGroup title="Şirket ve vergi" description="Fatura ve yasal metinlerde kullanılır.">
        <TextField
          id="store-legal-name"
          label="Şirket unvanı"
          value={values.legal_name}
          onChange={(legal_name) => onChange({ legal_name })}
        />
        <TextField
          id="store-tax-office"
          label="Vergi dairesi"
          value={values.tax_office}
          onChange={(tax_office) => onChange({ tax_office })}
        />
        <TextField
          id="store-tax-number"
          label="Vergi / TC kimlik no"
          hint="Şirketler için 10, şahıs şirketleri için 11 hane."
          value={values.tax_number}
          onChange={(tax_number) => onChange({ tax_number: tax_number.replace(/\D/g, "") })}
        />
      </FieldGroup>
      <FieldGroup title="Bakım modu">
        <SwitchField
          id="store-maintenance"
          label="Mağazayı bakıma al"
          hint="Açıkken ziyaretçilere bakım mesajı gösterilir."
          checked={values.maintenance_mode}
          onChange={(maintenance_mode) => onChange({ maintenance_mode })}
        />
        {values.maintenance_mode && (
          <TextField
            id="store-maintenance-message"
            label="Bakım mesajı"
            multiline
            placeholder="Kısa bir süre bakımdayız, birazdan geri döneceğiz."
            value={values.maintenance_message}
            onChange={(maintenance_message) => onChange({ maintenance_message })}
          />
        )}
      </FieldGroup>
    </>
  )
}
