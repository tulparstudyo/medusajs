export type CategoryImportEntry = {
  path: string[]
  depth: number
  name: string
  handle: string
  action: "create" | "exists"
  id: string | null
}

export type HandleRebuildResult = {
  dry_run: boolean
  parent_id: string | null
  changed: number
  changes: { id: string; path: string[]; from: string; to: string }[]
}

export type CategoryImportResult = {
  dry_run: boolean
  parent_id: string | null
  total: number
  created: number
  existing: number
  entries: CategoryImportEntry[]
}
