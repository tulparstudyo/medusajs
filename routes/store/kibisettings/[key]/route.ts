import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { KIBISETTINGS_MODULE } from "../../../../kibisis/kibisettings"
import KibisettingsModuleService from "../../../../kibisis/kibisettings/service"
import {
  isPublicSettingsKey,
  PUBLIC_SETTINGS_FIELDS,
} from "../../../../kibisis/kibisettings/types"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const key = req.params.key
  if (!isPublicSettingsKey(key)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Ayar grubu bulunamadı.")
  }

  const service = req.scope.resolve<KibisettingsModuleService>(KIBISETTINGS_MODULE)
  const { values } = await service.getSettings(key)
  const fields = PUBLIC_SETTINGS_FIELDS[key] as readonly string[] | null
  const source = values as Record<string, unknown>

  res.json({
    key,
    values: fields
      ? Object.fromEntries(fields.map((field) => [field, source[field]]))
      : values,
  })
}
