import { IyzicoAdapter } from "./adapter"
import { IyzicoClient } from "./client"
import { PAYMENT_API_VERSION, PaymentDefinition } from "./contract"

export const PRODUCT = "kibisis-iyzico"

const iyzico: PaymentDefinition = {
  apiVersion: PAYMENT_API_VERSION,
  id: "iyzico",
  product: PRODUCT,
  label: "iyzico",
  description: "iyzico Güvenli Ortak Ödeme Formu (Checkout Form) ile kredi/banka kartı ve taksitli ödeme.",
  licensed: false,
  supportsInstallments: true,
  credentials: [
    {
      key: "apiKey",
      label: "API Anahtarı",
      secret: true,
      required: true,
      placeholder: "sandbox-...",
      hint: "iyzico Kontrol Panelinizdeki API Anahtarı.",
    },
    {
      key: "secretKey",
      label: "Güvenlik Anahtarı (Secret Key)",
      secret: true,
      required: true,
      placeholder: "sandbox-...",
      hint: "iyzico Kontrol Panelinizdeki Güvenlik Anahtarı.",
    },
  ],
  createClient(config) {
    return new IyzicoClient(config)
  },
  adapter: new IyzicoAdapter(),
}

export default iyzico

