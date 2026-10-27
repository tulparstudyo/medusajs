export const SETTINGS_KEYS = [
  "store",
  "social",
  "payment",
  "shipping",
  "carriers",
  "smtp",
  "translate",
] as const

export type SettingsKey = (typeof SETTINGS_KEYS)[number]

export function isSettingsKey(value: unknown): value is SettingsKey {
  return typeof value === "string" && (SETTINGS_KEYS as readonly string[]).includes(value)
}

/** Groups the storefront may read without authentication. */
export const PUBLIC_SETTINGS_KEYS = ["social", "store"] as const satisfies readonly SettingsKey[]

export type PublicSettingsKey = (typeof PUBLIC_SETTINGS_KEYS)[number]

/** Fields of each public group the storefront receives; null exposes the whole group. */
export const PUBLIC_SETTINGS_FIELDS: {
  [K in PublicSettingsKey]: readonly (keyof SettingsValues[K])[] | null
} = {
  social: null,
  store: ["store_name", "legal_name", "email", "phone", "whatsapp", "address"],
}

export function isPublicSettingsKey(value: unknown): value is PublicSettingsKey {
  return typeof value === "string" && (PUBLIC_SETTINGS_KEYS as readonly string[]).includes(value)
}

export const SETTINGS_MENU: { key: SettingsKey; label: string; description: string }[] = [
  {
    key: "store",
    label: "Mağaza Ayarları",
    description: "Mağaza adı, iletişim, şirket ve vergi bilgileri, bakım modu.",
  },
  {
    key: "social",
    label: "Sosyal Medya",
    description: "Vitrinde gösterilen sosyal medya hesapları ve uygulama mağazası linkleri.",
  },
  {
    key: "payment",
    label: "Ödeme Ayarları",
    description: "Kredi kartı altyapısı, taksit, havale/EFT ve kapıda ödeme.",
  },
  {
    key: "shipping",
    label: "Kargo Ayarları",
    description: "Varsayılan kargo firması, ücretler, gönderim süresi ve gönderici bilgileri.",
  },
  {
    key: "carriers",
    label: "Kargo Firmaları",
    description: "Kurulu kargo firması paketlerinin lisans, entegrasyon ve takip bilgileri.",
  },
  {
    key: "smtp",
    label: "SMTP Ayarları",
    description: "E-posta gönderimi için sunucu, hesap ve gönderen bilgileri.",
  },
  {
    key: "translate",
    label: "AI Çeviri",
    description: "Bölüm çevirilerinde kullanılan otomatik çeviri hizmeti ve API anahtarları.",
  },
]

/** Providers with a working adapter. Add an id here only together with its kibitranslate provider. */
export const TRANSLATE_PROVIDERS = ["google", "gemini"] as const
export type TranslateProvider = (typeof TRANSLATE_PROVIDERS)[number]

/** Shown in the admin; providers without an adapter yet are listed as unavailable. */
export const TRANSLATE_PROVIDER_CATALOG: { id: string; label: string; available: boolean }[] = [
  { id: "google", label: "Google Translate (Cloud Translation)", available: true },
  { id: "gemini", label: "Google Gemini (AI Studio)", available: true },
  { id: "openai", label: "ChatGPT (OpenAI)", available: false },
]

export const GEMINI_DEFAULT_MODEL = "gemini-flash-latest"

export const PAYMENT_PROVIDERS = ["iyzico", "paytr"] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  iyzico: "iyzico",
  paytr: "PayTR",
}

export const PAYMENT_MODES = ["test", "live"] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  test: "Test (sandbox)",
  live: "Canlı",
}

/**
 * Carrier settings are flat `<carrier>_<field>` pairs. The carriers and their
 * credential fields come from installed carrier packages (see kibicarrier).
 */
export type CarrierSettings = Record<string, string | boolean>

export const CARRIER_BASE_DEFAULTS = {
  enabled: false,
  test_mode: true,
  tracking_url: "",
} satisfies CarrierSettings

export function carrierField(carrier: string, field: string): string {
  return `${carrier}_${field}`
}

export const SOCIAL_LINKS = ["instagram", "youtube", "tiktok", "facebook", "x", "linkedin"] as const
export type SocialLink = (typeof SOCIAL_LINKS)[number]

export const SOCIAL_LINK_LABELS: Record<SocialLink, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
}

export const APP_LINKS = ["app_store", "google_play", "app_gallery"] as const
export type AppLink = (typeof APP_LINKS)[number]

export const APP_LINK_LABELS: Record<AppLink, string> = {
  app_store: "App Store",
  google_play: "Google Play",
  app_gallery: "AppGallery",
}

export const SMTP_SECURITY = ["starttls", "ssl", "none"] as const
export type SmtpSecurity = (typeof SMTP_SECURITY)[number]

export const SMTP_SECURITY_LABELS: Record<SmtpSecurity, string> = {
  starttls: "STARTTLS (genelde 587)",
  ssl: "SSL/TLS (genelde 465)",
  none: "Şifrelemesiz (genelde 25)",
}

export type StoreSettings = {
  store_name: string
  legal_name: string
  email: string
  phone: string
  whatsapp: string
  address: string
  tax_office: string
  tax_number: string
  maintenance_mode: boolean
  maintenance_message: string
}

export type SocialSettings = Record<SocialLink | AppLink, string>

export type PaymentSettings = {
  card_enabled: boolean
  card_provider: PaymentProvider
  card_mode: PaymentMode
  card_merchant_id: string
  card_api_key: string
  card_secret_key: string
  installments_enabled: boolean
  max_installments: number
  bank_transfer_enabled: boolean
  bank_transfer_info: string
  bank_transfer_discount: number
  cod_enabled: boolean
  cod_fee: number
}

export type ShippingSettings = {
  default_carrier: string
  flat_rate: number
  free_shipping_threshold: number
  dispatch_days: number
  cutoff_time: string
  sender_name: string
  sender_phone: string
  sender_address: string
}

export type SmtpSettings = {
  enabled: boolean
  host: string
  port: number
  security: SmtpSecurity
  username: string
  password: string
  from_name: string
  from_email: string
  reply_to: string
}

export const GOOGLE_AUTH_MODES = ["api_key", "service_account"] as const
export type GoogleAuthMode = (typeof GOOGLE_AUTH_MODES)[number]

export const GOOGLE_AUTH_MODE_LABELS: Record<GoogleAuthMode, string> = {
  api_key: "API anahtarı",
  service_account: "Hizmet hesabı (JSON anahtar)",
}

export type TranslateSettings = {
  enabled: boolean
  provider: TranslateProvider
  google_auth: GoogleAuthMode
  google_api_key: string
  google_service_account: string
  gemini_api_key: string
  gemini_model: string
}

export type SettingsValues = {
  store: StoreSettings
  social: SocialSettings
  payment: PaymentSettings
  shipping: ShippingSettings
  carriers: CarrierSettings
  smtp: SmtpSettings
  translate: TranslateSettings
}

export type SecretField<K extends SettingsKey> = K extends "carriers"
  ? string
  : (typeof SECRET_FIELDS)[K][number] & keyof SettingsValues[K]

/** Carrier secrets are declared by each package and resolved on the server. */
export const SECRET_FIELDS = {
  store: [],
  social: [],
  payment: ["card_api_key", "card_secret_key"],
  shipping: [],
  carriers: [],
  smtp: ["password"],
  translate: ["google_api_key", "google_service_account", "gemini_api_key"],
} as const satisfies { [K in SettingsKey]: readonly (keyof SettingsValues[K])[] }

export const SETTINGS_DEFAULTS: SettingsValues = {
  store: {
    store_name: "",
    legal_name: "",
    email: "",
    phone: "",
    whatsapp: "",
    address: "",
    tax_office: "",
    tax_number: "",
    maintenance_mode: false,
    maintenance_message: "",
  },
  social: {
    instagram: "",
    youtube: "",
    tiktok: "",
    facebook: "",
    x: "",
    linkedin: "",
    app_store: "",
    google_play: "",
    app_gallery: "",
  },
  payment: {
    card_enabled: false,
    card_provider: "iyzico",
    card_mode: "test",
    card_merchant_id: "",
    card_api_key: "",
    card_secret_key: "",
    installments_enabled: false,
    max_installments: 6,
    bank_transfer_enabled: false,
    bank_transfer_info: "",
    bank_transfer_discount: 0,
    cod_enabled: false,
    cod_fee: 0,
  },
  shipping: {
    default_carrier: "",
    flat_rate: 0,
    free_shipping_threshold: 0,
    dispatch_days: 1,
    cutoff_time: "",
    sender_name: "",
    sender_phone: "",
    sender_address: "",
  },
  carriers: {},
  smtp: {
    enabled: false,
    host: "",
    port: 587,
    security: "starttls",
    username: "",
    password: "",
    from_name: "",
    from_email: "",
    reply_to: "",
  },
  translate: {
    enabled: false,
    provider: "google",
    google_auth: "api_key",
    google_api_key: "",
    google_service_account: "",
    gemini_api_key: "",
    gemini_model: GEMINI_DEFAULT_MODEL,
  },
}

export type SettingsDTO<K extends SettingsKey = SettingsKey> = {
  key: K
  values: SettingsValues[K]
  secrets: Record<string, boolean>
  updated_at: string | null
}

export type SettingsInput = Record<string, unknown>
