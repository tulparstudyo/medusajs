import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { KIBITRANSLATE_MODULE } from ".."
import KibitranslateModuleService, { MemoryEntryDTO } from "../service"

const serviceOf = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(KIBITRANSLATE_MODULE) as KibitranslateModuleService

export const editMemoryEntryStep = createStep(
  "edit-memory-entry",
  async (input: { id: string; translated_text: string }, { container }) => {
    const service = serviceOf(container)
    const previous = await service.getEntry(input.id)
    const entry = await service.editEntry(input.id, input.translated_text)
    return new StepResponse(entry, previous)
  },
  async (previous: MemoryEntryDTO | undefined, { container }) => {
    if (!previous) {
      return
    }

    await serviceOf(container).restoreEntry(previous)
  }
)

export const deleteMemoryEntriesStep = createStep(
  "delete-memory-entries",
  async (ids: string[], { container }) => {
    const deleted = await serviceOf(container).deleteEntries(ids)
    return new StepResponse(
      deleted.map((entry) => entry.id),
      deleted
    )
  },
  async (deleted: MemoryEntryDTO[] | undefined, { container }) => {
    if (!deleted?.length) {
      return
    }

    await serviceOf(container).recreateEntries(deleted)
  }
)
