import { AvailablePaymentProviderDTO } from "./types"

export const PAYMENT_MARKETPLACE: AvailablePaymentProviderDTO[] = [
  { id: "iyzico", label: "iyzico", repo: "kibisis-iyzico", licensed: false, status: "available" },
  { id: "paytr", label: "PayTR", repo: "kibisis-paytr", licensed: true, status: "available" },
  { id: "sipay", label: "Sipay", repo: "kibisis-sipay", licensed: true, status: "soon" },
  { id: "param", label: "Param POS", repo: "kibisis-param", licensed: true, status: "soon" },
]

