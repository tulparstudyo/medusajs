import { toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import { api } from "./api"
import { PaymentCatalogDTO, PaymentInstallDTO } from "../../kibipayment/types"

export function usePaymentCatalog() {
  const [catalog, setCatalog] = useState<PaymentCatalogDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    api<{ catalog: PaymentCatalogDTO }>("/admin/kibipayment/providers")
      .then((body) => {
        if (!cancelled) {
          setCatalog(body.catalog)
          setError(null)
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Ödeme paketleri okunamadı.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  return { catalog, error, reload }
}

export function usePaymentInstaller(onInstalled: (installation: PaymentInstallDTO) => void) {
  const [installing, setInstalling] = useState<string | null>(null)

  const install = useCallback(
    async (repo: string, label: string) => {
      setInstalling(repo)

      try {
        const { installation } = await api<{ installation: PaymentInstallDTO }>(
          "/admin/kibipayment/install",
          { method: "POST", body: JSON.stringify({ repo }) }
        )
        const commit = installation.commit ? ` ${installation.commit.slice(0, 7)}` : ""
        toast.success(`${label} kuruldu (${installation.ref}${commit}).`)
        onInstalled(installation)
      } catch (reason) {
        toast.error(reason instanceof Error ? reason.message : `${label} kurulamadı.`)
      } finally {
        setInstalling(null)
      }
    },
    [onInstalled]
  )

  return { install, installing }
}

