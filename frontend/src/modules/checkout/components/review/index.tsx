"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { Heading, Text, clx } from "@modules/common/components/ui"
import Modal from "@modules/common/components/modal"

import PaymentButton from "../payment-button"

const Review = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const searchParams = useSearchParams()
  const { countryCode } = useParams()
  const isTr = countryCode === "tr" || !countryCode

  const isOpen = searchParams.get("step") === "review"
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [activeModal, setActiveModal] = useState<"preInfo" | "distanceSales" | null>(null)
  const checkboxRef = useRef<HTMLInputElement>(null)

  const storageKey = cart?.id ? `terms_accepted_${cart.id}` : null

  // Browser geri dönüldüğünde (BFCache / history.back) veya sayfa yenilendiğinde
  // checkbox'ın işaretli gelmesine rağmen düğmenin disabled kalmasını önlemek için
  // hem sessionStorage hem de DOM input durumunu senkronize ediyoruz.
  useEffect(() => {
    const syncTermsState = () => {
      if (typeof window === "undefined") return
      const stored = storageKey ? sessionStorage.getItem(storageKey) === "true" : false
      const domChecked = checkboxRef.current?.checked ?? false
      if (stored || domChecked) {
        setTermsAccepted(true)
        if (checkboxRef.current) {
          checkboxRef.current.checked = true
        }
      }
    }

    syncTermsState()

    const onPageShow = () => {
      syncTermsState()
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [storageKey, isOpen])

  const handleTermsChange = (checked: boolean) => {
    setTermsAccepted(checked)
    if (storageKey && typeof window !== "undefined") {
      if (checked) {
        sessionStorage.setItem(storageKey, "true")
      } else {
        sessionStorage.removeItem(storageKey)
      }
    }
  }

  const handleAcceptFromModal = () => {
    setTermsAccepted(true)
    if (storageKey && typeof window !== "undefined") {
      sessionStorage.setItem(storageKey, "true")
    }
    if (checkboxRef.current) {
      checkboxRef.current.checked = true
    }
    setActiveModal(null)
  }

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards &&
    ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])?.length > 0 &&
    cart?.total === 0
  )

  const previousStepsCompleted =
    cart.shipping_address &&
    (cart.shipping_methods?.length ?? 0) > 0 &&
    (cart.payment_collection || paidByGiftcard)

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none": !isOpen,
            }
          )}
        >
          {isTr ? "Sipariş Onayı" : "Review"}
        </Heading>
      </div>

      {isOpen && previousStepsCompleted && (
        <>
          {/* Sözleşme Onay Alanı / Agreement Checkbox */}
          <div className="w-full mb-6 p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle/50">
            <label className="flex items-start gap-x-3 cursor-pointer select-none">
              <input
                ref={checkboxRef}
                type="checkbox"
                autoComplete="off"
                checked={termsAccepted}
                onChange={(e) => handleTermsChange(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-ui-border-base text-ui-fg-base focus:ring-ui-fg-base cursor-pointer"
                data-testid="terms-agreement-checkbox"
              />
              <div className="text-sm text-ui-fg-subtle leading-normal">
                {isTr ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setActiveModal("preInfo")
                      }}
                      className="font-medium text-ui-fg-base underline hover:text-ui-fg-interactive transition-colors"
                    >
                      Ön Bilgilendirme Koşulları
                    </button>
                    &apos;nı ve{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setActiveModal("distanceSales")
                      }}
                      className="font-medium text-ui-fg-base underline hover:text-ui-fg-interactive transition-colors"
                    >
                      Mesafeli Satış Sözleşmesi
                    </button>
                    &apos;ni okudum, kabul ediyorum.
                  </>
                ) : (
                  <>
                    I have read and accept the{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setActiveModal("distanceSales")
                      }}
                      className="font-medium text-ui-fg-base underline hover:text-ui-fg-interactive transition-colors"
                    >
                      Terms of Sale
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setActiveModal("preInfo")
                      }}
                      className="font-medium text-ui-fg-base underline hover:text-ui-fg-interactive transition-colors"
                    >
                      Privacy Policy
                    </button>
                    .
                  </>
                )}
              </div>
            </label>

            {!termsAccepted && (
              <p className="text-xs text-amber-700 mt-2 pl-7 font-medium">
                {isTr
                  ? "Siparişi tamamlayabilmek için lütfen sözleşmeyi onaylayınız."
                  : "Please accept the terms to complete your order."}
              </p>
            )}
          </div>

          <PaymentButton
            cart={cart}
            disabled={!termsAccepted}
            data-testid="submit-order-button"
          />

          {/* Ön Bilgilendirme Koşulları Modalı */}
          <Modal
            isOpen={activeModal === "preInfo"}
            close={() => setActiveModal(null)}
            size="large"
          >
            <Modal.Title>
              {isTr ? "Ön Bilgilendirme Formu" : "Pre-Information Form"}
            </Modal.Title>
            <Modal.Body>
              <div className="text-sm text-ui-fg-subtle space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                <p className="font-semibold text-ui-fg-base">1. TARAFLAR VE AMAÇ</p>
                <p>
                  İşbu form, Alıcı&apos;nın Satıcı&apos;ya ait web sitesinden elektronik ortamda siparişini
                  verdiği ürün/hizmetlerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin
                  Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince
                  bilgilendirilmesi amacıyla düzenlenmiştir.
                </p>
                <p className="font-semibold text-ui-fg-base">2. SİPARİŞ VE TESLİMAT</p>
                <p>
                  Sipariş edilen ürünler, Alıcı&apos;nın belirttiği teslimat adresine yasal 30 günlük
                  süreyi aşmamak koşuluyla kargo firması aracılığıyla teslim edilir.
                </p>
                <p className="font-semibold text-ui-fg-base">3. CAYMA HAKKI</p>
                <p>
                  Alıcı, sözleşme konusu ürünün kendisine veya gösterdiği adresteki kişi/kuruluşa
                  tesliminden itibaren 14 (on dört) gün içinde herhangi bir gerekçe göstermeksizin ve
                  cezai şart ödemeksizin cayma hakkına sahiptir.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                onClick={handleAcceptFromModal}
                className="w-full py-2 px-4 rounded bg-ui-bg-base text-ui-fg-base border border-ui-border-base hover:bg-ui-bg-subtle text-sm font-medium transition-colors"
              >
                {isTr ? "Okudum, Onaylıyorum" : "I Accept"}
              </button>
            </Modal.Footer>
          </Modal>

          {/* Mesafeli Satış Sözleşmesi Modalı */}
          <Modal
            isOpen={activeModal === "distanceSales"}
            close={() => setActiveModal(null)}
            size="large"
          >
            <Modal.Title>
              {isTr ? "Mesafeli Satış Sözleşmesi" : "Distance Sales Agreement"}
            </Modal.Title>
            <Modal.Body>
              <div className="text-sm text-ui-fg-subtle space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                <p className="font-semibold text-ui-fg-base">MADDE 1 - KONU</p>
                <p>
                  İşbu Sözleşme&apos;nin konusu, Alıcı&apos;nın Satıcı&apos;ya ait internet sitesinden
                  elektronik ortamda siparişini yaptığı ürünün satışı ve teslimi ile ilgili olarak
                  tarafların hak ve yükümlülüklerinin belirlenmesidir.
                </p>
                <p className="font-semibold text-ui-fg-base">MADDE 2 - GENEL HÜKÜMLER</p>
                <p>
                  Alıcı, internet sitesinde sözleşme konusu ürünün temel nitelikleri, satış fiyatı ve
                  ödeme şekli ile teslimata ilişkin ön bilgileri okuyup bilgi sahibi olduğunu ve
                  elektronik ortamda gerekli teyidi verdiğini beyan eder.
                </p>
                <p className="font-semibold text-ui-fg-base">MADDE 3 - UYUŞMAZLIKLARIN ÇÖZÜMÜ</p>
                <p>
                  İşbu Sözleşme&apos;den doğabilecek uyuşmazlıklarda Ticaret Bakanlığı&apos;nca ilan
                  edilen değere kadar Tüketici Hakem Heyetleri, bu değerin üzerindeki uyuşmazlıklarda
                  ise Tüketici Mahkemeleri yetkilidir.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                onClick={handleAcceptFromModal}
                className="w-full py-2 px-4 rounded bg-ui-bg-base text-ui-fg-base border border-ui-border-base hover:bg-ui-bg-subtle text-sm font-medium transition-colors"
              >
                {isTr ? "Okudum, Onaylıyorum" : "I Accept"}
              </button>
            </Modal.Footer>
          </Modal>
        </>
      )}
    </div>
  )
}

export default Review
