import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { KIBISETTINGS_MODULE } from "../../../../kibisis/kibisettings"
import KibisettingsModuleService from "../../../../kibisis/kibisettings/service"
import { isSettingsKey, SettingsInput, SettingsKey } from "../../../../kibisis/kibisettings/types"

function readKey(req: MedusaRequest): SettingsKey {
  const key = req.params.key
  if (!isSettingsKey(key)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Ayar grubu bulunamadı.")
  }

  return key
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<KibisettingsModuleService>(KIBISETTINGS_MODULE)
  res.json({ settings: await service.getSettings(readKey(req)) })
}

export async function POST(req: MedusaRequest<SettingsInput>, res: MedusaResponse) {
  const key = readKey(req)
  const service = req.scope.resolve<KibisettingsModuleService>(KIBISETTINGS_MODULE)
  res.json({ settings: await service.updateSettings(key, req.validatedBody) })
}
