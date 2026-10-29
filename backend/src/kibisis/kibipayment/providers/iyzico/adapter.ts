import {
  PaymentAdapter,
  PaymentCallbackRequest,
  PaymentDocument,
  PaymentError,
  PaymentSessionRequest,
  PaymentSessionResult,
  PaymentVerifyResult,
} from "./contract"

export class IyzicoAdapter implements PaymentAdapter {
  toSession(request: PaymentSessionRequest): PaymentDocument {
    const buyer = request.buyer
    const billing = request.billingAddress
    const shipping = request.shippingAddress

    const basketItems = request.basket.map((item, index) => ({
      id: item.id || `BI${index + 1}`,
      name: item.name.slice(0, 100),
      category1: item.category.slice(0, 100),
      itemType: "PHYSICAL",
      price: item.price,
    }))

    return {
      locale: request.locale === "en" ? "en" : "tr",
      conversationId: request.reference,
      price: request.amount,
      paidPrice: request.amount,
      currency: request.currency,
      basketId: request.cartId || request.reference,
      paymentGroup: "PRODUCT",
      callbackUrl: request.callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9, 12],
      buyer: {
        id: buyer.id || buyer.email || "BY1",
        name: buyer.name || "Müşteri",
        surname: buyer.surname || "Müşteri",
        gsmNumber: buyer.phone || "+905555555555",
        email: buyer.email,
        identityNumber: buyer.identityNumber || "11111111111",
        registrationAddress: buyer.address || "Adres",
        ip: buyer.ip || "127.0.0.1",
        city: buyer.city || "İstanbul",
        country: buyer.country || "Turkey",
        zipCode: buyer.postalCode || "34000",
      },
      shippingAddress: {
        contactName: `${shipping.name} ${shipping.surname}`.trim() || buyer.name,
        city: shipping.city || buyer.city || "İstanbul",
        country: shipping.country || buyer.country || "Turkey",
        address: shipping.address || buyer.address || "Adres",
        zipCode: shipping.postalCode || buyer.postalCode || "34000",
      },
      billingAddress: {
        contactName: `${billing.name} ${billing.surname}`.trim() || buyer.name,
        city: billing.city || buyer.city || "İstanbul",
        country: billing.country || buyer.country || "Turkey",
        address: billing.address || buyer.address || "Adres",
        zipCode: billing.postalCode || buyer.postalCode || "34000",
      },
      basketItems,
    }
  }

  fromSession(request: PaymentSessionRequest, response: PaymentDocument): PaymentSessionResult {
    const token = typeof response.token === "string" ? response.token : null
    const checkoutFormContent = typeof response.checkoutFormContent === "string" ? response.checkoutFormContent : ""
    const paymentPageUrl = typeof response.paymentPageUrl === "string" ? response.paymentPageUrl : null

    if (!checkoutFormContent && !paymentPageUrl) {
      throw new PaymentError("iyzico ödeme formu içeriği üretilemedi.", "invalid_response")
    }

    return {
      reference: request.reference,
      providerReference: token,
      mode: "html",
      htmlContent: checkoutFormContent,
      paymentPageUrl,
      token,
      raw: response,
    }
  }

  toVerify(request: PaymentCallbackRequest): PaymentDocument {
    const token = request.token || request.body.token
    if (!token || typeof token !== "string") {
      throw new PaymentError("iyzico callback doğrulama için token gerekli.", "invalid_request")
    }

    return {
      locale: "tr",
      conversationId: request.reference || "",
      token,
    }
  }

  fromVerify(request: PaymentCallbackRequest, response: PaymentDocument): PaymentVerifyResult {
    const isSuccess = response.status === "success" && response.paymentStatus === "SUCCESS"
    const reference = (response.conversationId as string) || request.reference || ""
    const providerReference = (response.paymentId as string) || (response.token as string) || null

    if (!isSuccess) {
      return {
        reference,
        providerReference,
        status: "failed",
        errorMessage: (response.errorMessage as string) || "Ödeme iyzico tarafından onaylanmadı.",
      }
    }

    return {
      reference,
      providerReference,
      status: "captured",
      paidAmount: typeof response.paidPrice === "string" ? response.paidPrice : null,
      installment: typeof response.installment === "number" ? response.installment : 1,
      cardFamily: (response.cardFamily as string) || null,
      lastFourDigits: (response.lastFourDigits as string) || null,
      acknowledgmentBody: JSON.stringify({ status: "success" }),
    }
  }
}

