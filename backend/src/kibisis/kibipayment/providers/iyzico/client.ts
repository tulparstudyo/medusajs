import { createHmac, randomBytes } from "crypto"
import { PaymentClient, PaymentConfig, PaymentDocument, PaymentError } from "./contract"

export const IYZICO_ENDPOINTS = {
  test: "https://sandbox-api.iyzipay.com",
  live: "https://api.iyzipay.com",
}

const TIMEOUT_MS = 25_000

export class IyzicoClient implements PaymentClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly secretKey: string

  constructor(config: PaymentConfig, private readonly fetchImpl = fetch) {
    this.apiKey = config.credentials.apiKey || config.credentials.api_key || ""
    this.secretKey = config.credentials.secretKey || config.credentials.secret_key || ""
    this.baseUrl = config.testMode ? IYZICO_ENDPOINTS.test : IYZICO_ENDPOINTS.live

    if (!this.apiKey || !this.secretKey) {
      throw new PaymentError("iyzico API anahtarı ve Güvenlik anahtarı gerekli.", "credentials_missing")
    }
  }

  async initializeSession(payload: PaymentDocument): Promise<PaymentDocument> {
    const path = "/payment/iyzipay/checkoutform/initialize/auth/ecom"
    return this.request(path, payload)
  }

  async verifyCallback(payload: PaymentDocument): Promise<PaymentDocument> {
    const path = "/payment/iyzipay/checkoutform/auth/ecom/detail"
    return this.request(path, payload)
  }

  private async request(uri: string, payload: PaymentDocument): Promise<PaymentDocument> {
    const url = `${this.baseUrl}${uri}`
    const bodyStr = JSON.stringify(payload)
    const randomKey = `${Date.now()}${randomBytes(4).toString("hex")}`

    const payloadToSign = `${randomKey}${uri}${bodyStr}`
    const signature = createHmac("sha256", this.secretKey).update(payloadToSign).digest("hex")
    const authHeader = `IYZWSv2 apiKey:${this.apiKey}&randomKey:${randomKey}&signature:${signature}`

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: authHeader,
          "x-iyzi-rnd": randomKey,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new PaymentError(`iyzico servisine ulaşılamadı: ${reason}`, "network_error")
    }

    let json: PaymentDocument
    try {
      json = (await response.json()) as PaymentDocument
    } catch {
      throw new PaymentError(`iyzico geçersiz yanıt döndü (HTTP ${response.status}).`, "invalid_response")
    }

    if (json.status !== "success") {
      const msg = String(json.errorMessage || json.errorGroup || "iyzico işlemi onaylamadı")
      throw new PaymentError(`iyzico hatası: ${msg}`, "payment_rejected")
    }

    return json
  }
}

