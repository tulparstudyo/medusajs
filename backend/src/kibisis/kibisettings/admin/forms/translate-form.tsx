import { Button, Label, Select, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

import { FieldGroup, SecretField, SelectField, SwitchField, TextField } from "../fields"
import { SettingsFormProps } from "../settings-screen"
import {
  GEMINI_DEFAULT_MODEL,
  GOOGLE_AUTH_MODE_LABELS,
  GOOGLE_AUTH_MODES,
  TRANSLATE_PROVIDER_CATALOG,
  TranslateProvider,
} from "../../types"

export default function TranslateForm({
  values,
  onChange,
  secret,
}: SettingsFormProps<"translate">) {
  return (
    <>
      <FieldGroup title="Durum">
        <SwitchField
          id="translate-enabled"
          label="AI çeviriyi kullan"
          hint="Açıkken bölüm formlarındaki Çeviriler alanında AI translate düğmesi çalışır."
          checked={values.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
      </FieldGroup>
      <FieldGroup
        title="Çeviri hafızası"
        description="Çevrilen metinler hash ile saklanır; aynı metin tekrar istendiğinde servise gönderilmez. Kayıtları görüntüleyip düzenleyebilir veya silebilirsiniz."
      >
        <div>
          <Button size="small" variant="secondary" asChild>
            <Link to="/kibisettings/translate/memory">Çeviri hafızasını aç</Link>
          </Button>
        </div>
      </FieldGroup>
      <FieldGroup
        title="Çeviri hizmeti"
        description="Metinler seçilen hizmete gönderilir; ücretlendirme hizmet sağlayıcının hesabınıza uyguladığı tarifeye göre yapılır."
      >
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="translate-provider" size="small">
            Hizmet
          </Label>
          <Select
            value={values.provider}
            onValueChange={(provider) => onChange({ provider: provider as TranslateProvider })}
          >
            <Select.Trigger id="translate-provider">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {TRANSLATE_PROVIDER_CATALOG.map((provider) => (
                <Select.Item key={provider.id} value={provider.id} disabled={!provider.available}>
                  {provider.available ? provider.label : `${provider.label} (yakında)`}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        {values.provider === "google" && (
          <>
            <SelectField
              id="translate-google-auth"
              label="Kimlik doğrulama"
              hint='API anahtarı "API keys are not supported" hatası veriyorsa hizmet hesabını kullanın.'
              value={values.google_auth}
              options={GOOGLE_AUTH_MODES}
              labels={GOOGLE_AUTH_MODE_LABELS}
              onChange={(google_auth) => onChange({ google_auth })}
            />
            {values.google_auth === "api_key" ? (
              <>
                <SecretField
                  id="translate-google-api-key"
                  label="Google API anahtarı"
                  hint="Google Cloud Console → API'ler ve Hizmetler → Kimlik bilgileri'nden oluşturulan standart API anahtarı. Kayıtlı değer güvenlik nedeniyle gösterilmez."
                  state={secret("google_api_key")}
                />
                <Text size="small" className="text-ui-fg-subtle">
                  Anahtarı oluştururken &quot;hizmet hesabı üzerinden kimlik doğrula&quot; seçeneğini
                  işaretlemeyin ve API kısıtlamasında yalnızca Cloud Translation API&apos;yi seçin.
                </Text>
              </>
            ) : (
              <>
                <SecretField
                  id="translate-google-service-account"
                  label="Hizmet hesabı anahtarı (JSON)"
                  hint="IAM → Hizmet hesapları'nda Cloud Translation API User rolü verilmiş bir hesap için Anahtarlar → JSON ile indirilen dosyanın tüm içeriğini yapıştırın. Kayıtlı değer güvenlik nedeniyle gösterilmez."
                  state={secret("google_service_account")}
                />
              </>
            )}
          </>
        )}
        {values.provider === "gemini" && (
          <>
            <SecretField
              id="translate-gemini-api-key"
              label="Gemini API anahtarı"
              hint="Google AI Studio → Get API key ile alınan anahtar. Kayıtlı değer güvenlik nedeniyle gösterilmez."
              state={secret("gemini_api_key")}
            />
            <TextField
              id="translate-gemini-model"
              label="Model"
              placeholder={GEMINI_DEFAULT_MODEL}
              hint="Boş bırakılırsa gemini-flash-latest kullanılır."
              value={values.gemini_model}
              onChange={(gemini_model) => onChange({ gemini_model })}
            />
          </>
        )}
      </FieldGroup>
    </>
  )
}
