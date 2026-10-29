import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { installedProviders } from "../../../../kibisis/kibipayment/registry"
import { KIBISETTINGS_MODULE } from "../../../../kibisis/kibisettings"
import KibisettingsModuleService from "../../../../kibisis/kibisettings/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const settings = await req.scope
    .resolve<KibisettingsModuleService>(KIBISETTINGS_MODULE)
    .getSecretSettings("payment")
  const flat = settings as unknown as Record<string, unknown>

  const cardProviders = installedProviders().providers
    .filter((provider) => flat[`${provider.id}_enabled`] === true)
    .map((provider) => ({
      id: provider.id,
      label: provider.definition.label,
      description: provider.definition.description ?? null,
      supports_installments: provider.definition.supportsInstallments !== false && flat[`${provider.id}_installments_enabled`] === true,
      max_installments: (flat[`${provider.id}_max_installments`] as number) ?? 6,
    }))

  res.json({
    card_providers: cardProviders,
    bank_transfer: {
      enabled: flat.bank_transfer_enabled === true,
      info: typeof flat.bank_transfer_info === "string" ? flat.bank_transfer_info : "",
      discount: typeof flat.bank_transfer_discount === "number" ? flat.bank_transfer_discount : 0,
    },
    cod: {
      enabled: flat.cod_enabled === true,
      fee: typeof flat.cod_fee === "number" ? flat.cod_fee : 0,
    },
  })
}

