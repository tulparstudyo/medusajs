import {
  FieldGroup,
  NumberField,
  SecretField,
  SelectField,
  SwitchField,
  TextField,
} from "../fields"
import { SettingsFormProps } from "../settings-screen"
import {
  PAYMENT_MODE_LABELS,
  PAYMENT_MODES,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_PROVIDERS,
} from "../../types"

export default function PaymentForm({ values, onChange, secret }: SettingsFormProps<"payment">) {
  const paytr = values.card_provider === "paytr"

  return (
    <>
      <FieldGroup title="Kredi kartı" description="Sanal POS / ödeme kuruluşu bilgileri.">
        <SwitchField
          id="payment-card"
          label="Kredi kartı ile ödeme"
          checked={values.card_enabled}
          onChange={(card_enabled) => onChange({ card_enabled })}
        />
        {values.card_enabled && (
          <>
            <SelectField
              id="payment-provider"
              label="Ödeme altyapısı"
              value={values.card_provider}
              options={PAYMENT_PROVIDERS}
              labels={PAYMENT_PROVIDER_LABELS}
              onChange={(card_provider) => onChange({ card_provider })}
            />
            <SelectField
              id="payment-mode"
              label="Ortam"
              hint="Gerçek tahsilat için Canlı seçin."
              value={values.card_mode}
              options={PAYMENT_MODES}
              labels={PAYMENT_MODE_LABELS}
              onChange={(card_mode) => onChange({ card_mode })}
            />
            {paytr && (
              <TextField
                id="payment-merchant-id"
                label="Mağaza no (merchant_id)"
                value={values.card_merchant_id}
                onChange={(card_merchant_id) => onChange({ card_merchant_id })}
              />
            )}
            <SecretField
              id="payment-api-key"
              label={paytr ? "Mağaza parola (merchant_key)" : "API anahtarı"}
              state={secret("card_api_key")}
            />
            <SecretField
              id="payment-secret-key"
              label={paytr ? "Mağaza gizli anahtar (merchant_salt)" : "Güvenlik anahtarı"}
              state={secret("card_secret_key")}
            />
          </>
        )}
      </FieldGroup>
      {values.card_enabled && (
        <FieldGroup title="Taksit">
          <SwitchField
            id="payment-installments"
            label="Taksitli ödeme"
            checked={values.installments_enabled}
            onChange={(installments_enabled) => onChange({ installments_enabled })}
          />
          {values.installments_enabled && (
            <NumberField
              id="payment-max-installments"
              label="En fazla taksit sayısı"
              min={1}
              max={12}
              value={values.max_installments}
              onChange={(max_installments) => onChange({ max_installments })}
            />
          )}
        </FieldGroup>
      )}
      <FieldGroup title="Havale / EFT">
        <SwitchField
          id="payment-bank-transfer"
          label="Havale / EFT ile ödeme"
          checked={values.bank_transfer_enabled}
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
              value={values.bank_transfer_info}
              onChange={(bank_transfer_info) => onChange({ bank_transfer_info })}
            />
            <NumberField
              id="payment-bank-discount"
              label="Havale indirimi"
              suffix="%"
              step={0.1}
              max={50}
              value={values.bank_transfer_discount}
              onChange={(bank_transfer_discount) => onChange({ bank_transfer_discount })}
            />
          </>
        )}
      </FieldGroup>
      <FieldGroup title="Kapıda ödeme">
        <SwitchField
          id="payment-cod"
          label="Kapıda ödeme"
          checked={values.cod_enabled}
          onChange={(cod_enabled) => onChange({ cod_enabled })}
        />
        {values.cod_enabled && (
          <NumberField
            id="payment-cod-fee"
            label="Kapıda ödeme hizmet bedeli"
            suffix="TL"
            step={0.01}
            value={values.cod_fee}
            onChange={(cod_fee) => onChange({ cod_fee })}
          />
        )}
      </FieldGroup>
    </>
  )
}
