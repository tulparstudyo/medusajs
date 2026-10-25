import { toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import { api } from "./api"
import { CarrierCatalogDTO, CarrierInstallDTO } from "../../kibicarrier/types"

export function useCarrierCatalog() {
  const [catalog, setCatalog] = useState<CarrierCatalogDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    api<{ catalog: CarrierCatalogDTO }>("/admin/kibicarrier/carriers")
      .then((body) => {
        if (!cancelled) {
          setCatalog(body.catalog)
          setError(null)
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Kargo paketleri okunamadı.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  return { catalog, error, reload }
}

export function useCarrierInstaller(onInstalled: (installation: CarrierInstallDTO) => void) {
  const [installing, setInstalling] = useState<string | null>(null)

  const install = useCallback(
    async (repo: string, label: string) => {
      setInstalling(repo)

      try {
        const { installation } = await api<{ installation: CarrierInstallDTO }>(
          "/admin/kibicarrier/install",
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
