export type CarrierCredentialDTO = {
  key: string
  label: string
  secret: boolean
  required: boolean
  placeholder: string | null
  hint: string | null
}

export type CarrierLicenseDTO = {
  valid: boolean
  reason: string | null
  customer: string | null
  expires_at: string | null
  ref: string | null
  checked_at: string
}

export type InstalledCarrierDTO = {
  id: string
  label: string
  description: string | null
  repo: string
  ref: string
  commit: string
  version: string
  installed_at: string
  product: string
  tracking_url: string
  credentials: CarrierCredentialDTO[]
  license: CarrierLicenseDTO
}

export type AvailableCarrierDTO = {
  id: string
  label: string
  repo: string
  status: "available" | "soon"
}

export type CarrierCatalogDTO = {
  installed: InstalledCarrierDTO[]
  available: AvailableCarrierDTO[]
  errors: { id: string; message: string }[]
  install_enabled: boolean
  domain: string
  store_url: string | null
}

export type CarrierInstallDTO = {
  id: string
  repo: string
  ref: string
  commit: string
  version: string
  files: number
}
