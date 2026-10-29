export type PaymentCredentialDTO = {
  key: string
  label: string
  secret: boolean
  required: boolean
  placeholder: string | null
  hint: string | null
}

export type PaymentLicenseDTO = {
  valid: boolean
  licensed: boolean
  reason: string | null
  customer: string | null
  expires_at: string | null
  ref: string | null
  checked_at: string
}

export type InstalledPaymentProviderDTO = {
  id: string
  label: string
  description: string | null
  repo: string
  ref: string
  commit: string
  version: string
  installed_at: string
  product: string
  licensed: boolean
  supports_installments: boolean
  credentials: PaymentCredentialDTO[]
  license: PaymentLicenseDTO
}

export type AvailablePaymentProviderDTO = {
  id: string
  label: string
  repo: string
  licensed: boolean
  status: "available" | "soon"
}

export type PaymentCatalogDTO = {
  installed: InstalledPaymentProviderDTO[]
  available: AvailablePaymentProviderDTO[]
  errors: { id: string; message: string }[]
  install_enabled: boolean
  domain: string
  store_url: string | null
}

export type PaymentInstallDTO = {
  id: string
  repo: string
  ref: string
  commit: string
  version: string
  files: number
}

