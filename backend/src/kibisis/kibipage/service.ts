import { MedusaError, MedusaService } from "@medusajs/framework/utils"

import { readSettings, serializeSection } from "./lib/serialize"
import { defaultSettings } from "./lib/settings"
import { localizeSettings } from "./lib/translations"
import PageRecord from "./models/page-record"
import PageSection from "./models/section"
import {
  CreatePageInput,
  defaultPageLabel,
  isDefaultPageKey,
  isPageKey,
  isSectionType,
  isSystemPageKey,
  KIBI_PAGE_KEYS,
  KIBI_PAGE_LABELS,
  PageDTO,
  PageKey,
  PublicPageDTO,
  PublicSectionDTO,
  ReorderSectionInput,
  SectionDTO,
  SectionSettings,
  SectionType,
  SECTION_LABELS,
  UpdatePageInput,
} from "./types"

export type PageRow = {
  id: string
  page_key: string
  label?: string | null
  created_at?: Date | string
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
    await this.ensureDefaultPages()
    const rows = await this.listAllPages()
    const sorted = this.sortPages(rows)
    const pages: PageDTO[] = []

    for (const row of sorted) {
      pages.push(await this.serializePage(row))
    }

    return pages
  }

  async getPage(idOrKey: string): Promise<PageDTO> {
    await this.ensureDefaultPages()
    const page = await this.resolvePageRow(idOrKey)
    return this.serializePage(page)
  }

  async createPage(input: CreatePageInput): Promise<PageDTO> {
    await this.ensureDefaultPages()
    const key = input.page_key.trim()
    const label = input.label.trim()

    if (!isPageKey(key)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Sayfa anahtarı geçersiz.")
    }

    if (!label) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Sayfa adı gerekli.")
    }

    const existing = await this.listPageRecords({ page_key: key }, { take: 1 })
    if (existing[0]) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        "Bu sayfa anahtarı zaten kullanılıyor."
      )
    }

    const created = await this.createPageRecords({
      page_key: key,
      label,
    })

    return this.serializePage(created)
  }

  async updatePage(
    idOrKey: string,
    input: UpdatePageInput
  ): Promise<{ previous: PageRow; page: PageDTO }> {
    await this.ensureDefaultPages()
    const existing = await this.resolvePageRow(idOrKey)
    const key = input.page_key.trim()
    const label = input.label.trim()

    if (!isPageKey(key)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Sayfa anahtarı geçersiz.")
    }

    if (!label) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Sayfa adı gerekli.")
    }

    if (isSystemPageKey(existing.page_key) && key !== existing.page_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Sistem sayfalarının anahtarı değiştirilemez."
      )
    }

    if (key !== existing.page_key) {
      if (isSystemPageKey(key)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Sistem sayfası anahtarları başka bir sayfaya verilemez."
        )
      }

      const duplicate = await this.listPageRecords({ page_key: key }, { take: 1 })
      if (duplicate[0] && duplicate[0].id !== existing.id) {
        throw new MedusaError(
          MedusaError.Types.DUPLICATE_ERROR,
          "Bu sayfa anahtarı zaten kullanılıyor."
        )
      }
    }

    const updated = await this.updatePageRecords({
      id: existing.id,
      page_key: key,
      label,
    })

    return {
      previous: existing,
      page: await this.serializePage(updated),
    }
  }

  async deletePage(idOrKey: string): Promise<{ page: PageRow; sectionIds: string[] }> {
    await this.ensureDefaultPages()
    const existing = await this.resolvePageRow(idOrKey)

    if (isSystemPageKey(existing.page_key)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Sistem sayfaları silinemez."
      )
    }

    const sections = await this.listAllSections(existing.id)
    const sectionIds = sections.map((section) => section.id)

    if (sectionIds.length > 0) {
      await this.deletePageSections(sectionIds)
    }

    await this.deletePageRecords(existing.id)

    return {
      page: existing,
      sectionIds,
    }
  }

  async listSections(pageKey: PageKey): Promise<SectionDTO[]> {
    const page = await this.requirePageByKey(pageKey)
    const sections = await this.listAllSections(page.id)
    return sections.map((section) => serializeSection(section, page.page_key))
  }

  async getPublicPage(pageKey: PageKey, locale?: string): Promise<PublicPageDTO> {
    const page = await this.requirePageByKey(pageKey)
    const sections = await this.listAllSections(page.id)
    const label = (page.label ?? "").trim() || defaultPageLabel(page.page_key)

    return {
      page_key: page.page_key,
      label,
      sections: sections
        .filter((section) => section.is_active)
        .map((section) => ({
          id: section.id,
          type: section.type,
          position: section.position,
          settings: localizeSettings(readSettings(section.settings), locale),
        })),
    }
  }

  async listPublicSections(pageKey: PageKey, locale?: string): Promise<PublicSectionDTO[]> {
    const page = await this.getPublicPage(pageKey, locale)
    return page.sections
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
    const page = await this.requirePageByKey(input.page_key)
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

    return serializeSection(created, page.page_key)
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
    const page = await this.requirePageByKey(pageKey)
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

    return this.listSections(page.page_key)
  }

  async previousOrder(pageKey: PageKey): Promise<ReorderSectionInput[]> {
    const page = await this.requirePageByKey(pageKey)
    const sections = await this.listAllSections(page.id)
    return sections.map((section) => ({
      id: section.id,
      position: section.position,
    }))
  }

  private async ensureDefaultPages(): Promise<void> {
    const anyPage = await this.listPageRecords({}, { take: 1 })
    if (anyPage.length === 0) {
      for (const key of KIBI_PAGE_KEYS) {
        await this.ensurePage(key, KIBI_PAGE_LABELS[key])
      }
      return
    }

    for (const key of ["home", "product"] as const) {
      await this.ensurePage(key, KIBI_PAGE_LABELS[key])
    }
  }

  private async requirePageByKey(pageKey: PageKey): Promise<PageRow> {
    await this.ensureDefaultPages()

    if (isSystemPageKey(pageKey)) {
      return this.ensurePage(pageKey, KIBI_PAGE_LABELS[pageKey])
    }

    const existing = await this.listPageRecords({ page_key: pageKey }, { take: 1 })
    if (!existing[0]) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sayfa bulunamadı.")
    }

    return existing[0]
  }

  private async resolvePageRow(idOrKey: string): Promise<PageRow> {
    const byKey = await this.listPageRecords({ page_key: idOrKey }, { take: 1 })
    if (byKey[0]) {
      return byKey[0]
    }

    const byId = await this.listPageRecords({ id: idOrKey }, { take: 1 })
    if (byId[0]) {
      return byId[0]
    }

    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sayfa bulunamadı.")
  }

  private async serializePage(row: PageRow): Promise<PageDTO> {
    const label = (row.label ?? "").trim() || defaultPageLabel(row.page_key)
    if (!(row.label ?? "").trim() && isDefaultPageKey(row.page_key)) {
      await this.updatePageRecords({ id: row.id, label })
    }

    const sections = await this.listAllSections(row.id)
    return {
      id: row.id,
      key: row.page_key,
      label,
      is_system: isSystemPageKey(row.page_key),
      section_count: sections.length,
    }
  }

  private sortPages(rows: PageRow[]): PageRow[] {
    const defaultOrder = new Map<string, number>(
      KIBI_PAGE_KEYS.map((key, index) => [key, index])
    )

    return rows.slice().sort((a, b) => {
      const aSystem = isSystemPageKey(a.page_key)
      const bSystem = isSystemPageKey(b.page_key)
      if (aSystem !== bSystem) {
        return aSystem ? -1 : 1
      }

      const aDefault = defaultOrder.get(a.page_key)
      const bDefault = defaultOrder.get(b.page_key)
      if (aDefault !== undefined && bDefault !== undefined) {
        return aDefault - bDefault
      }
      if (aDefault !== undefined) {
        return -1
      }
      if (bDefault !== undefined) {
        return 1
      }

      return 0
    })
  }

  private async listAllPages(): Promise<PageRow[]> {
    const pageSize = 200
    const pages: PageRow[] = []
    let skip = 0

    while (skip <= 5000) {
      const batch = await this.listPageRecords(
        {},
        {
          take: pageSize,
          skip,
          order: { created_at: "ASC" },
        }
      )

      pages.push(...batch)
      if (batch.length < pageSize) {
        break
      }

      skip += pageSize
    }

    return pages
  }

  private async ensurePage(pageKey: PageKey, label?: string): Promise<PageRow> {
    const resolvedLabel = (label ?? "").trim() || defaultPageLabel(pageKey)
    const existing = await this.listPageRecords({ page_key: pageKey }, { take: 1 })
    if (existing[0]) {
      if (!(existing[0].label ?? "").trim() && resolvedLabel) {
        return await this.updatePageRecords({
          id: existing[0].id,
          label: resolvedLabel,
        })
      }
      return existing[0]
    }

    try {
      const created = await this.createPageRecords({
        page_key: pageKey,
        label: resolvedLabel,
      })
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
