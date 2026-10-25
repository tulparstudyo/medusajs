import { FieldGroup, NumberField, SecretField, SelectField, SwitchField, TextField } from "../fields"
import { SettingsFormProps } from "../settings-screen"
import { SMTP_SECURITY, SMTP_SECURITY_LABELS, SmtpSecurity } from "../../types"

const DEFAULT_PORTS: Record<SmtpSecurity, number> = {
  starttls: 587,
  ssl: 465,
  none: 25,
}

export default function SmtpForm({ values, onChange, secret }: SettingsFormProps<"smtp">) {
  return (
    <>
      <FieldGroup title="Durum">
        <SwitchField
          id="smtp-enabled"
          label="SMTP ile e-posta gönder"
          hint="Kapalıyken sipariş ve üyelik e-postaları bu sunucudan gönderilmez."
          checked={values.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
      </FieldGroup>
      <FieldGroup title="Sunucu">
        <TextField
          id="smtp-host"
          label="SMTP sunucusu"
          placeholder="smtp.ornek.com"
          value={values.host}
          onChange={(host) => onChange({ host })}
        />
        <SelectField
          id="smtp-security"
          label="Güvenlik"
          value={values.security}
          options={SMTP_SECURITY}
          labels={SMTP_SECURITY_LABELS}
          onChange={(security) =>
            onChange(
              values.port === DEFAULT_PORTS[values.security]
                ? { security, port: DEFAULT_PORTS[security] }
                : { security }
            )
          }
        />
        <NumberField
          id="smtp-port"
          label="Port"
          min={1}
          max={65535}
          value={values.port}
          onChange={(port) => onChange({ port })}
        />
      </FieldGroup>
      <FieldGroup title="Hesap">
        <TextField
          id="smtp-username"
          label="Kullanıcı adı"
          placeholder="bildirim@ornek.com"
          value={values.username}
          onChange={(username) => onChange({ username })}
        />
        <SecretField id="smtp-password" label="Şifre" state={secret("password")} />
      </FieldGroup>
      <FieldGroup title="Gönderen">
        <TextField
          id="smtp-from-name"
          label="Gönderen adı"
          value={values.from_name}
          onChange={(from_name) => onChange({ from_name })}
        />
        <TextField
          id="smtp-from-email"
          label="Gönderen e-posta"
          type="email"
          value={values.from_email}
          onChange={(from_email) => onChange({ from_email })}
        />
        <TextField
          id="smtp-reply-to"
          label="Yanıt adresi"
          type="email"
          hint="Boş bırakılırsa yanıtlar gönderen adresine gelir."
          value={values.reply_to}
          onChange={(reply_to) => onChange({ reply_to })}
        />
      </FieldGroup>
    </>
  )
}
