import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { KIBIPAGE_MODULE } from ".."
import { defaultSettings, normalizeSettings } from "../lib/settings"
import KibipageModuleService from "../service"
import {
  CreateSectionInput,
  isSectionType,
  ReorderSectionsInput,
  SECTION_LABELS,
  SectionDTO,
  SectionType,
  UpdateSectionInput,
} from "../types"

const serviceOf = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(KIBIPAGE_MODULE) as KibipageModuleService

function sectionTypeOf(type: string): SectionType {
  if (!isSectionType(type)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Bölüm türü geçersiz.")
  }

  return type
}

export const createSectionStep = createStep(
  "create-section",
  async (input: CreateSectionInput, { container }) => {
    const settings = normalizeSettings(
      input.type,
      input.settings === undefined ? defaultSettings(input.type) : input.settings
    )
    const section = await serviceOf(container).createSection({
      page_key: input.page_key,
      type: input.type,
      name: input.name?.trim() || SECTION_LABELS[input.type],
      is_active: input.is_active ?? true,
      settings,
    })

    return new StepResponse(section, section.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    await serviceOf(container).deletePageSections(id)
  }
)

export const updateSectionStep = createStep(
  "update-section",
  async (input: { id: string; data: UpdateSectionInput }, { container }) => {
    const service = serviceOf(container)
    const previous = await service.getSection(input.id)
    const settings = normalizeSettings(
      sectionTypeOf(previous.type),
      input.data.settings
    )
    const section = await service.updateSection(input.id, {
      name: input.data.name,
      is_active: input.data.is_active,
      settings,
    })

    return new StepResponse(section, previous)
  },
  async (previous: SectionDTO | undefined, { container }) => {
    if (!previous) {
      return
    }

    await serviceOf(container).updatePageSections({
      id: previous.id,
      name: previous.name,
      is_active: previous.is_active,
      settings: previous.settings,
    })
  }
)

export const deleteSectionStep = createStep(
  "delete-section",
  async (id: string, { container }) => {
    const service = serviceOf(container)
    const previous = await service.getSection(id)
    await service.deleteSection(id)
    return new StepResponse({ id: previous.id }, previous.id)
  },
  async (id: string | undefined, { container }) => {
    if (!id) {
      return
    }

    await serviceOf(container).restorePageSections([id])
  }
)

export const reorderSectionsStep = createStep(
  "reorder-sections",
  async (input: ReorderSectionsInput, { container }) => {
    const service = serviceOf(container)
    const previous = await service.previousOrder(input.page_key)
    const sections = await service.reorderSections(input.page_key, input.items)
    return new StepResponse(sections, {
      page_key: input.page_key,
      items: previous,
    })
  },
  async (previous: ReorderSectionsInput | undefined, { container }) => {
    if (!previous?.items.length) {
      return
    }

    await serviceOf(container).updatePageSections(
      previous.items.map((item) => ({
        id: item.id,
        position: item.position,
      }))
    )
  }
)
