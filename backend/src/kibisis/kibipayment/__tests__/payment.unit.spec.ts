import fs from "fs"
import os from "os"
import path from "path"

import { discoverProviders, resolveProviderLicense } from "../registry"
import { paymentDefaults, paymentProviderConfig, paymentSecretFields } from "../settings"
import { IyzicoAdapter } from "../providers/iyzico/adapter"
import { PaymentSessionRequest } from "../contract"

function writeProvider(root: string, id: string, licensed = false, apiVersion = 1) {
  const build = "abc1234-old"
  const dir = path.join(root, id, build)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(root, id, "current.json"), JSON.stringify({ build }))
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify({ repo: `kibisis-${id}`, ref: "main", commit: "abc1234", version: "1.0.0", installedAt: "2026-10-29T00:00:00.000Z" })
  )
  fs.writeFileSync(
    path.join(dir, "index.js"),
    `exports.default = {
      apiVersion: ${apiVersion},
      id: "${id}",
      product: "kibisis-${id}",
      label: "Ödeme ${id}",
      licensed: ${licensed},
      supportsInstallments: true,
      credentials: [
        { key: "apiKey", label: "API Anahtarı", secret: true },
        { key: "secretKey", label: "Gizli Anahtar", secret: true },
      ],
      createClient() { return {} },
      adapter: {},
    }`
  )
}

describe("kibipayment", () => {
  let root: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "kibipayment-"))
    writeProvider(root, "fake", false)
    writeProvider(root, "future", false, 2)
    fs.mkdirSync(path.join(root, "nocurrent", "abc1234-old"), { recursive: true })
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("loads installed payment providers and reports invalid ones", () => {
    const { providers, errors } = discoverProviders(root)

    expect(
      providers.map((p) => [p.id, p.build, p.repo, p.version, p.commit])
    ).toEqual([["fake", "abc1234-old", "kibisis-fake", "1.0.0", "abc1234"]])
    expect(errors.map((e) => e.id).sort()).toEqual(["future", "nocurrent"])
  })

  it("derives dynamic settings fields from provider credentials", () => {
    const definitions = discoverProviders(root).providers.map((p) => p.definition)

    expect(paymentDefaults(definitions)).toEqual({
      bank_transfer_enabled: false,
      bank_transfer_info: "",
      bank_transfer_discount: 0,
      cod_enabled: false,
      cod_fee: 0,
      fake_enabled: false,
      fake_test_mode: true,
      fake_installments_enabled: false,
      fake_max_installments: 6,
      fake_apiKey: "",
      fake_secretKey: "",
    })

    expect(paymentSecretFields(definitions)).toEqual(["fake_apiKey", "fake_secretKey"])

    expect(
      paymentProviderConfig(definitions[0], {
        fake_enabled: true,
        fake_test_mode: false,
        fake_installments_enabled: true,
        fake_max_installments: 12,
        fake_apiKey: "key123",
        fake_secretKey: "sec456",
      })
    ).toEqual({
      enabled: true,
      config: {
        testMode: false,
        installmentsEnabled: true,
        maxInstallments: 12,
        credentials: {
          apiKey: "key123",
          secretKey: "sec456",
        },
      },
    })
  })

  it("grants valid license immediately for unlicensed / free packages without remote call", async () => {
    const provider = discoverProviders(root).providers[0]
    const license = await resolveProviderLicense(provider)

    expect(license).toMatchObject({
      valid: true,
      licensed: false,
      customer: "Ücretsiz paket",
      reason: null,
      ref: "main",
    })
  })

  it("maps iyzico checkout form request and response correctly in adapter", () => {
    const adapter = new IyzicoAdapter()
    const request: PaymentSessionRequest = {
      reference: "ORD-101",
      cartId: "cart_101",
      amount: "150.00",
      currency: "TRY",
      locale: "tr",
      callbackUrl: "https://shop.example/callback",
      buyer: {
        id: "usr_1",
        name: "Ahmet",
        surname: "Yılmaz",
        email: "ahmet@example.com",
        phone: "+905551234567",
        address: "Kadıköy",
        city: "İstanbul",
        country: "Turkey",
      },
      billingAddress: {
        name: "Ahmet",
        surname: "Yılmaz",
        email: "ahmet@example.com",
        phone: "+905551234567",
        address: "Kadıköy",
        city: "İstanbul",
        country: "Turkey",
      },
      shippingAddress: {
        name: "Ahmet",
        surname: "Yılmaz",
        email: "ahmet@example.com",
        phone: "+905551234567",
        address: "Kadıköy",
        city: "İstanbul",
        country: "Turkey",
      },
      basket: [
        { id: "p1", name: "Tişört", category: "Giyim", price: "150.00" },
      ],
    }

    const payload = adapter.toSession(request)
    expect(payload).toMatchObject({
      conversationId: "ORD-101",
      price: "150.00",
      paidPrice: "150.00",
      currency: "TRY",
      callbackUrl: "https://shop.example/callback",
      buyer: {
        name: "Ahmet",
        surname: "Yılmaz",
        email: "ahmet@example.com",
      },
    })

    const sessionResult = adapter.fromSession(request, {
      status: "success",
      token: "tok_123",
      checkoutFormContent: "<script src='...'>",
      paymentPageUrl: "https://sandbox-cpp.iyzipay.com/...",
    })

    expect(sessionResult).toEqual({
      reference: "ORD-101",
      providerReference: "tok_123",
      mode: "html",
      htmlContent: "<script src='...'>",
      paymentPageUrl: "https://sandbox-cpp.iyzipay.com/...",
      token: "tok_123",
      raw: expect.any(Object),
    })

    const verifyResult = adapter.fromVerify(
      { reference: "ORD-101", token: "tok_123", body: {} },
      {
        status: "success",
        paymentStatus: "SUCCESS",
        paymentId: "pay_999",
        paidPrice: "150.00",
        installment: 3,
        cardFamily: "Bonus",
        lastFourDigits: "0008",
      }
    )

    expect(verifyResult).toEqual({
      reference: "ORD-101",
      providerReference: "pay_999",
      status: "captured",
      paidAmount: "150.00",
      installment: 3,
      cardFamily: "Bonus",
      lastFourDigits: "0008",
      acknowledgmentBody: JSON.stringify({ status: "success" }),
    })
  })
})
