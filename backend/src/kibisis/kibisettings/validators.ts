import { z } from "@medusajs/framework/zod"

import { installedCarriers } from "../kibicarrier/registry"
import {
  APP_LINK_LABELS,
  APP_LINKS,
  carrierField,
  GOOGLE_AUTH_MODES,
  PAYMENT_MODES,
  PAYMENT_PROVIDERS,
  SettingsKey,
  SMTP_SECURITY,
  SOCIAL_LINK_LABELS,
  SOCIAL_LINKS,
  TRANSLATE_PROVIDERS,
} from "./types"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function text(max: number) {
  return z.string().trim().max(max, `En fazla ${max} karakter olabilir.`).default("")
}

function email(message = "Geçerli bir e-posta adresi girin.") {
  return text(200).refine((value) => value === "" || EMAIL_PATTERN.test(value), message)
}

function httpUrl(message: string) {
  return text(500).refine((value) => {
    if (value === "") {
      return true
    }

    try {
      const url = new URL(value.replace("{code}", "0"))
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }, message)
}

function money(max = 1_000_000) {
  return z.number().min(0, "Tutar negatif olamaz.").max(max).default(0)
}

// Empty string or a missing field keeps the stored secret, null clears it.
const secret = z.string().trim().max(500).nullable().optional()

export const StoreSettingsSchema = z
  .object({
    store_name: text(120),
    legal_name: text(200),
    email: email(),
    phone: text(40),
    whatsapp: text(40),
    address: text(500),
    tax_office: text(80),
    tax_number: text(11).refine(
      (value) => value === "" || /^\d{10,11}$/.test(value),
      "Vergi / TC kimlik no 10 veya 11 haneli olmalı."
    ),
    maintenance_mode: z.boolean().default(false),
    maintenance_message: text(300),
    listing_image_width: z
      .number()
      .int()
      .min(0, "Genişlik negatif olamaz.")
      .max(4096, "Genişlik en fazla 4096 px olabilir.")
      .default(0),
    listing_image_height: z
      .number()
      .int()
      .min(0, "Yükseklik negatif olamaz.")
      .max(4096, "Yükseklik en fazla 4096 px olabilir.")
      .default(0),
  })
  .strict()

const socialShape: Record<string, z.ZodType> = {}

for (const link of SOCIAL_LINKS) {
  socialShape[link] = httpUrl(`${SOCIAL_LINK_LABELS[link]} linki http(s) ile başlamalı.`)
}

for (const link of APP_LINKS) {
  socialShape[link] = httpUrl(`${APP_LINK_LABELS[link]} linki http(s) ile başlamalı.`)
}

export const SocialSettingsSchema = z.object(socialShape).strict()

export const PaymentSettingsSchema = z
  .object({
    card_enabled: z.boolean().default(false),
    card_provider: z.enum(PAYMENT_PROVIDERS).default("iyzico"),
    card_mode: z.enum(PAYMENT_MODES).default("test"),
    card_merchant_id: text(120),
    card_api_key: secret,
    card_secret_key: secret,
    installments_enabled: z.boolean().default(false),
    max_installments: z.number().int().min(1).max(12, "En fazla 12 taksit.").default(6),
    bank_transfer_enabled: z.boolean().default(false),
    bank_transfer_info: text(2000),
    bank_transfer_discount: z
      .number()
      .min(0, "İndirim negatif olamaz.")
      .max(50, "İndirim en fazla %50 olabilir.")
      .default(0),
    cod_enabled: z.boolean().default(false),
    cod_fee: money(100_000),
  })
  .strict()

export const ShippingSettingsSchema = z
  .object({
    default_carrier: text(30),
    flat_rate: money(100_000),
    free_shipping_threshold: money(),
    dispatch_days: z.number().int().min(0).max(30, "En fazla 30 gün.").default(1),
    cutoff_time: text(5).refine(
      (value) => value === "" || TIME_PATTERN.test(value),
      "Saat SS:DD biçiminde olmalı (ör. 15:00)."
    ),
    sender_name: text(120),
    sender_phone: text(40),
    sender_address: text(500),
  })
  .strict()

/** Built per request: carriers can be installed while the server runs. */
export function carrierSettingsSchema() {
  const shape: Record<string, z.ZodType> = {}

  for (const { definition } of installedCarriers().carriers) {
    const field = (name: string) => carrierField(definition.id, name)
    shape[field("enabled")] = z.boolean().default(false)
    shape[field("test_mode")] = z.boolean().default(true)
    shape[field("tracking_url")] = httpUrl(`${definition.label} takip adresi http(s) ile başlamalı.`)

    for (const credential of definition.credentials) {
      shape[field(credential.key)] = credential.secret ? secret : text(200)
    }
  }

  return z.object(shape).strict()
}

export const SmtpSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    host: text(200),
    port: z.number().int().min(1).max(65535, "Port 1-65535 arasında olmalı.").default(587),
    security: z.enum(SMTP_SECURITY).default("starttls"),
    username: text(200),
    password: secret,
    from_name: text(120),
    from_email: email("Gönderen e-posta adresi geçersiz."),
    reply_to: email("Yanıt adresi geçersiz."),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.enabled) {
      return
    }

    if (!value.host) {
      ctx.addIssue({ code: "custom", path: ["host"], message: "SMTP sunucusu gerekli." })
    }

    if (!value.from_email) {
      ctx.addIssue({
        code: "custom",
        path: ["from_email"],
        message: "Gönderen e-posta adresi gerekli.",
      })
    }
  })

function isServiceAccountJson(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return (
      parsed?.type === "service_account" &&
      typeof parsed.client_email === "string" &&
      typeof parsed.private_key === "string"
    )
  } catch {
    return false
  }
}

export const TranslateSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    provider: z.enum(TRANSLATE_PROVIDERS, { message: "Bu çeviri hizmeti henüz desteklenmiyor." }).default("google"),
    google_auth: z.enum(GOOGLE_AUTH_MODES).default("api_key"),
    google_api_key: secret,
    google_service_account: z
      .string()
      .trim()
      .max(10_000, "Hizmet hesabı anahtarı çok uzun.")
      .refine(
        (value) => value === "" || isServiceAccountJson(value),
        "Hizmet hesabı anahtarı, Google Cloud'dan indirilen JSON dosyasının içeriği olmalı."
      )
      .nullable()
      .optional(),
    gemini_api_key: secret,
    gemini_model: text(80).refine(
      (value) => value === "" || /^[a-z0-9][a-z0-9.\-]*$/.test(value),
      "Model adı küçük harf, rakam, nokta ve tireden oluşmalı (ör. gemini-flash-latest)."
    ),
  })
  .strict()

export const SETTINGS_SCHEMAS = {
  store: StoreSettingsSchema,
  social: SocialSettingsSchema,
  payment: PaymentSettingsSchema,
  shipping: ShippingSettingsSchema,
  carriers: carrierSettingsSchema,
  smtp: SmtpSettingsSchema,
  translate: TranslateSettingsSchema,
} satisfies Record<SettingsKey, z.ZodType | (() => z.ZodType)>
