import { MedusaError } from "@medusajs/framework/utils"

import { CreateNavItemInput, NormalizedTarget, UpdateNavItemInput } from "../types"

const ANCHOR_PATTERN = /^#[A-Za-z0-9][A-Za-z0-9_-]*$/

export function normalizeTarget(
  input: CreateNavItemInput | UpdateNavItemInput
): NormalizedTarget {
  if (input.target_type === "category") {
    const categoryId = input.category_id?.trim()
    if (!categoryId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Kategori seçin."
      )
    }

    return {
      target_type: "category",
      category_id: categoryId,
      url: null,
      anchor: null,
      new_tab: false,
    }
  }

  if (input.target_type === "url") {
    return {
      target_type: "url",
      category_id: null,
      url: normalizeUrl(input.url),
      anchor: null,
      new_tab: input.new_tab === true,
    }
  }

  return {
    target_type: "anchor",
    category_id: null,
    url: null,
    anchor: normalizeAnchor(input.anchor),
    new_tab: false,
  }
}

export function normalizeUrl(value: string | undefined): string {
  let url: URL

  try {
    url = new URL(value?.trim() ?? "")
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Yalnızca http:// veya https:// bağlantısı girin."
    )
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Yalnızca http:// veya https:// bağlantısı girin."
    )
  }

  return url.toString()
}

export function normalizeAnchor(value: string | undefined): string {
  const trimmed = value?.trim() ?? ""

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || /\s/.test(trimmed)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Sayfa içi bağlantı / veya # ile başlamalıdır. Örnek: /static/hakkimizda veya #hedef"
      )
    }

    return trimmed
  }

  const anchor = trimmed.startsWith("#") ? trimmed : `#${trimmed}`

  if (!ANCHOR_PATTERN.test(anchor)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Sayfa içi bağlantı / veya # ile başlamalıdır. Örnek: /static/hakkimizda veya #hedef"
    )
  }

  return anchor
}
