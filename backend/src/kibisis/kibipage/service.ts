import { MedusaError, MedusaService } from "@medusajs/framework/utils"

import { readSettings, serializeSection } from "./lib/serialize"
import { defaultSettings } from "./lib/settings"
import { localizeSettings } from "./lib/translations"
import PageRecord from "./models/page-record"
import PageSection from "./models/section"
import {
  isPageKey,
  isSectionType,
  KIBI_PAGE_KEYS,
  KIBI_PAGE_LABELS,
  PageDTO,
  PageKey,
  PublicSectionDTO,
  ReorderSectionInput,
  SectionDTO,
  SectionSettings,
  SectionType,
  SECTION_LABELS,
} from "./types"

type PageRow = {
  id: string
  page_key: string
}

type SectionRow = {
  id: string
  page_id: string
  type: string
  name: string
  position: number
  is_active: boolean
  settings?: unknown
}

type CreateSectionRow = {
  page_key: PageKey
  type: SectionType
  name: string
  is_active: boolean
  settings: SectionSettings
}

type UpdateSectionRow = {
  name: string
  is_active: boolean
  settings: SectionSettings
}

class KibipageModuleService extends MedusaService({
  PageRecord,
  PageSection,
}) {
  async listPages(): Promise<PageDTO[]> {
    const pages: PageDTO[] = []

    for (const key of KIBI_PAGE_KEYS) {
      const page = await this.ensurePage(key)
      const sections = await this.listAllSections(page.id)
      pages.push({
        id: page.id,
        key,
        label: KIBI_PAGE_LABELS[key],
        section_count: sections.length,
      })
    }

    return pages
  }

  async listSections(pageKey: PageKey): Promise<SectionDTO[]> {
    const page = await this.ensurePage(pageKey)
    const sections = await this.listAllSections(page.id)
    return sections.map((section) => serializeSection(section, pageKey))
  }

  async listPublicSections(pageKey: PageKey, locale?: string): Promise<PublicSectionDTO[]> {
    const page = await this.ensurePage(pageKey)
    const sections = await this.listAllSections(page.id)
    return sections
      .filter((section) => section.is_active)
      .map((section) => ({
        id: section.id,
        type: section.type,
        position: section.position,
        settings: localizeSettings(readSettings(section.settings), locale),
      }))
  }

  async getSection(id: string): Promise<SectionDTO> {
    const section = await this.retrieveExisting(id)
    const page = await this.retrievePageRecord(section.page_id)
    if (!isPageKey(page.page_key)) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sayfa bulunamadı.")
    }

    return serializeSection(section, page.page_key)
  }

  async createSection(input: CreateSectionRow): Promise<SectionDTO> {
    const page = await this.ensurePage(input.page_key)
    if (!isSectionType(input.type)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Bölüm türü geçersiz.")
    }

    const siblings = await this.listAllSections(page.id)
    const position =
      siblings.reduce((max, section) => Math.max(max, section.position), -1) + 1
    const name = input.name.trim() || SECTION_LABELS[input.type]

    const created = await this.createPageSections({
      page_id: page.id,
      type: input.type,
      name,
      position,
      is_active: input.is_active,
      settings: input.settings,
    })

    return serializeSection(created, input.page_key)
  }

  async updateSection(id: string, input: UpdateSectionRow): Promise<SectionDTO> {
    const current = await this.getSection(id)
    const updated = await this.updatePageSections({
      id,
      name: input.name.trim(),
      is_active: input.is_active,
      settings: input.settings,
    })

    return serializeSection(updated, current.page_key)
  }

  async deleteSection(id: string): Promise<void> {
    await this.retrieveExisting(id)
    await this.deletePageSections(id)
  }

  async reorderSections(
    pageKey: PageKey,
    updates: ReorderSectionInput[]
  ): Promise<SectionDTO[]> {
    const page = await this.ensurePage(pageKey)
    const existing = await this.listAllSections(page.id)
    const existingIds = new Set(existing.map((section) => section.id))

    if (updates.length !== existing.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Sayfadaki bölümlerin tamamı gönderilmelidir."
      )
    }

    const seen = new Set<string>()
    const positions = new Set<number>()

    for (const update of updates) {
      if (!existingIds.has(update.id) || seen.has(update.id)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Bölüm bu sayfaya ait değil veya listede tekrar ediyor."
        )
      }

      if (positions.has(update.position)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Bölüm sırası tekrar ediyor."
        )
      }

      seen.add(update.id)
      positions.add(update.position)
    }

    if (updates.length) {
      await this.updatePageSections(
        updates.map((update) => ({
          id: update.id,
          position: update.position,
        }))
      )
    }

    return this.listSections(pageKey)
  }

  async previousOrder(pageKey: PageKey): Promise<ReorderSectionInput[]> {
    const page = await this.ensurePage(pageKey)
    const sections = await this.listAllSections(page.id)
    return sections.map((section) => ({
      id: section.id,
      position: section.position,
    }))
  }

  private async ensurePage(pageKey: PageKey): Promise<PageRow> {
    const existing = await this.listPageRecords({ page_key: pageKey }, { take: 1 })
    if (existing[0]) {
      return existing[0]
    }

    try {
      const created = await this.createPageRecords({ page_key: pageKey })
      if (pageKey === "home") {
        await this.seedHome(created.id)
      }
      return created
    } catch (error) {
      const again = await this.listPageRecords({ page_key: pageKey }, { take: 1 })
      if (again[0]) {
        return again[0]
      }

      throw error
    }
  }

  private async seedHome(pageId: string) {
    const types: SectionType[] = [
      "quick-categories",
      "hero-showcase",
      "selected-product",
      "promo-banner",
      "selected-product",
      "fast-links",
      "fast-links",
      "icon-box",
    ]

    await this.createPageSections(
      types.map((type, position) => {
        const popular = position === 2
        const advantageous = position === 4
        const brandLinks = position === 5
        const searchLinks = position === 6
        const iconBoxes = position === 7
        const settings = popular
          ? {
              ...defaultSettings(type),
              source: "popular",
              title: "Popüler ürünlerden seçtik",
            }
          : advantageous
            ? {
                ...defaultSettings(type),
                source: "advantageous",
                title: "En Avantajlı Ürünler",
              }
            : brandLinks
              ? { ...defaultSettings(type), title: "Trend Markalar", variant: "outline" }
              : searchLinks
                ? { ...defaultSettings(type), title: "Popüler Aramalar Bu Hafta", variant: "pill" }
                : defaultSettings(type)

        return {
          page_id: pageId,
          type,
          name: popular
            ? "Popüler ürünler"
            : advantageous
              ? "Avantajlı ürünler"
              : brandLinks
                ? "Trend Markalar"
                : searchLinks
                  ? "Popüler aramalar"
                  : iconBoxes
                    ? "Güven şeridi"
                    : SECTION_LABELS[type],
          position,
          is_active: true,
          settings,
        }
      })
    )
  }

  private async retrieveExisting(id: string): Promise<SectionRow> {
    try {
      return await this.retrievePageSection(id)
    } catch (error) {
      if (
        MedusaError.isMedusaError(error) &&
        error.type === MedusaError.Types.NOT_FOUND
      ) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Bölüm bulunamadı.")
      }

      throw error
    }
  }

  private async listAllSections(pageId: string): Promise<SectionRow[]> {
    const pageSize = 200
    const sections: SectionRow[] = []
    let skip = 0

    while (skip <= 5000) {
      const page = await this.listPageSections(
        { page_id: pageId },
        {
          take: pageSize,
          skip,
          order: { position: "ASC" },
        }
      )

      sections.push(...page)
      if (page.length < pageSize) {
        break
      }

      skip += pageSize
    }

    return sections
  }
}

export default KibipageModuleService
