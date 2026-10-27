export type Tag = {
  attrs: Record<string, string>
  start: number
  end: number
}

export type OptionValue = {
  id: string
  label: string
  barcode: string
  sku: string
  stock: string
  images: string[]
}

export type OptionGroup = {
  id: string
  name: string
  values: OptionValue[]
}

export type SiblingLink = {
  url: string
  label: string
  selected: boolean
}

export type Siblings = {
  name: string
  links: SiblingLink[]
}

const ATTRIBUTES = String.raw`((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*/?>`
const IMAGE_FILE = /\.(?:webp|jpe?g|png|gif|avif)(?:[?#]|$)/i

/**
 * ProductLink drops the variant suffix (-v-SKU) of a link. A variant link
 * opens the same product with one option chosen and describes only that
 * option in its structured data.
 */
export function productLink(url: string): string {
  try {
    const address = new URL(url.trim())
    address.pathname = address.pathname.replace(/-v-[^/]+$/, "")
    return address.toString()
  } catch {
    return url.trim()
  }
}

/**
 * ProductLd reads the schema.org Product or ProductGroup block. The theme
 * prints descriptions with raw line breaks inside JSON strings, so the block
 * is repaired before it is decoded.
 */
export function productLd(html: string): Record<string, unknown> | null {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)

  for (const block of blocks) {
    let decoded: unknown

    try {
      decoded = JSON.parse(repairJson(block[1] ?? ""))
    } catch {
      continue
    }

    const record = asRecord(decoded)
    const type = record?.["@type"]

    if (type === "Product" || type === "ProductGroup") {
      return record
    }
  }

  return null
}

/**
 * RepairJson fixes the mistakes the storefront template makes: control
 * characters inside strings, trailing commas, and on product groups an extra
 * brace after the variant list that closes the document before its offer.
 */
export function repairJson(source: string): string {
  const trailing = /\s*[\]}]/y
  const content = /\S/g
  let output = ""
  let inString = false
  let escaped = false
  let depth = 0

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] as string

    if (inString) {
      if (escaped) {
        escaped = false
        output += char
        continue
      }

      if (char === "\\") {
        escaped = true
        output += char
        continue
      }

      if (char === '"') {
        inString = false
        output += char
        continue
      }

      const code = char.charCodeAt(0)

      if (code < 0x20) {
        output += char === "\n" ? "\\n" : char === "\r" ? "\\r" : char === "\t" ? "\\t" : `\\u${code.toString(16).padStart(4, "0")}`
        continue
      }

      output += char
      continue
    }

    if (char === '"') {
      inString = true
      output += char
      continue
    }

    if (char === ",") {
      trailing.lastIndex = index + 1

      if (trailing.test(source)) {
        continue
      }
    }

    if (char === "{" || char === "[") {
      depth += 1
    }

    if (char === "}" || char === "]") {
      if (depth === 1) {
        content.lastIndex = index + 1

        if (content.test(source)) {
          continue
        }
      }

      depth -= 1
    }

    output += char
  }

  return output
}

export function productId(html: string): string {
  for (const tag of tags(html, "input")) {
    if (tag.attrs.name === "product_id" && /^\d+$/.test(tag.attrs.value ?? "")) {
      return tag.attrs.value as string
    }
  }

  return ""
}

/**
 * GalleryImages returns the large picture of every gallery thumbnail above
 * the product title, in page order.
 */
export function galleryImages(html: string, pageUrl: string): string[] {
  const head = html.slice(0, titleIndex(html))
  const images: string[] = []

  for (const tag of tags(head, "a")) {
    const classes = (tag.attrs.class ?? "").split(/\s+/)
    const href = absolute(decodeEntities(tag.attrs.href ?? ""), pageUrl)

    if (classes.includes("thumbnail") && href && IMAGE_FILE.test(href) && !images.includes(href)) {
      images.push(href)
    }
  }

  return images
}

/**
 * MainSection is the part of the page that describes the product itself:
 * from the title to the add to cart form. Related product cards come later.
 */
export function mainSection(html: string): string {
  const start = titleIndex(html)
  const cart = html.indexOf('name="product_id"', start)

  return html.slice(start, cart > start ? cart : start + 60_000)
}

export function oldPrice(section: string): string {
  const match = section.match(/<span[^>]*text-decoration:\s*line-through[^>]*>([\s\S]*?)<\/span>/i)

  return match ? parsePrice(stripTags(match[1] ?? "")) : ""
}

export function stockText(section: string): string {
  const match = section.match(/id=["']stock-status["'][^>]*>([\s\S]*?)<\/(?:span|sapn|div|li)>/i)

  return match ? stripTags(match[1] ?? "") : ""
}

/**
 * OptionGroups reads OpenCart options (select and radio inputs named
 * option[ID]). The theme puts the barcode, SKU and stock of a value on the
 * value itself as data attributes.
 */
export function optionGroups(section: string): OptionGroup[] {
  const groups: OptionGroup[] = []

  for (const select of tags(section, "select")) {
    const id = optionId(select.attrs.name)

    if (!id) {
      continue
    }

    const close = section.indexOf("</select>", select.end)
    const body = section.slice(select.end, close > 0 ? close : undefined)
    const values: OptionValue[] = []

    for (const option of tags(body, "option")) {
      const value = option.attrs.value ?? ""
      const closeOption = body.indexOf("</option>", option.end)
      const label = stripTags(body.slice(option.end, closeOption > 0 ? closeOption : option.end))

      if (value && label) {
        values.push(optionValue(option, label))
      }
    }

    groups.push({ id, name: labelFor(section, id), values })
  }

  const radios = new Map<string, OptionValue[]>()

  for (const input of tags(section, "input")) {
    const id = optionId(input.attrs.name)

    if (!id || !["radio", "checkbox"].includes((input.attrs.type ?? "").toLowerCase())) {
      continue
    }

    const closeLabel = section.indexOf("</label>", input.end)
    const label = stripTags(section.slice(input.end, closeLabel > 0 ? closeLabel : input.end))

    if (input.attrs.value && label) {
      radios.set(id, [...(radios.get(id) ?? []), optionValue(input, label)])
    }
  }

  for (const [id, values] of radios) {
    groups.push({ id, name: labelFor(section, id), values })
  }

  return groups.filter((group) => group.values.length > 0)
}

/**
 * Siblings reads the selector that links to other products of the same line,
 * such as other sizes. Each option is a link and the current page is selected.
 */
export function siblings(section: string, pageUrl: string): Siblings | null {
  for (const select of tags(section, "select")) {
    if (optionId(select.attrs.name)) {
      continue
    }

    const close = section.indexOf("</select>", select.end)
    const body = section.slice(select.end, close > 0 ? close : undefined)
    const links: SiblingLink[] = []

    for (const option of tags(body, "option")) {
      const value = decodeEntities(option.attrs.value ?? "").trim()
      const url = /^https?:\/\//i.test(value) ? absolute(value, pageUrl) : null
      const closeOption = body.indexOf("</option>", option.end)
      const label = stripTags(body.slice(option.end, closeOption > 0 ? closeOption : option.end))

      if (url && label) {
        links.push({ url, label, selected: "selected" in option.attrs })
      }
    }

    if (links.length) {
      const name = lastLabel(section.slice(Math.max(0, select.start - 1500), select.start))

      return { name: name || decodeEntities(select.attrs["aria-label"] ?? "") || "Seçenek", links }
    }
  }

  return null
}

/**
 * ParsePrice turns a shop price such as "1.341,00TL" into "1341.00".
 */
export function parsePrice(text: string): string {
  const digits = text.replace(/[^\d.,]/g, "")

  if (!/\d/.test(digits)) {
    return ""
  }

  const comma = digits.lastIndexOf(",")
  const dot = digits.lastIndexOf(".")

  if (comma > dot) {
    return digits.replace(/\./g, "").replace(",", ".")
  }

  if (digits.indexOf(".") !== dot) {
    return digits.replace(/[.,]/g, "")
  }

  return digits.replace(/,/g, "")
}

export function metaContent(html: string, property: string): string {
  for (const tag of tags(html, "meta")) {
    if (tag.attrs.property === property || tag.attrs.name === property) {
      return decodeEntities(tag.attrs.content ?? "").trim()
    }
  }

  return ""
}

export function tags(html: string, name: string): Tag[] {
  const pattern = new RegExp(`<${name}\\b${ATTRIBUTES}`, "gi")
  const found: Tag[] = []

  for (const match of html.matchAll(pattern)) {
    const start = match.index ?? 0
    found.push({ attrs: attributes(match[1] ?? ""), start, end: start + match[0].length })
  }

  return found
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
}

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|#039|lt|gt|nbsp);/gi, (entity, code: string) => {
    const lower = code.toLowerCase()

    if (lower.startsWith("#x")) {
      return String.fromCodePoint(parseInt(lower.slice(2), 16))
    }

    if (lower.startsWith("#")) {
      return String.fromCodePoint(Number(lower.slice(1)))
    }

    return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " }[lower] ?? entity
  })
}

/**
 * OptionValue keeps the pictures the theme shows for a value: the box in
 * that colour (data-tup), the swatch and the extra photos.
 */
function optionValue(tag: Tag, label: string): OptionValue {
  const images = [
    tag.attrs["data-tup"],
    tag.attrs["data-ciopimagepopup"],
    ...(tag.attrs["data-ciopekfoto"] ?? "").split(","),
  ]
    .map((image) => decodeEntities(image ?? "").trim())
    .filter((image) => /^https:\/\//i.test(image))

  return {
    id: tag.attrs.value ?? "",
    label,
    barcode: (tag.attrs["data-barkod"] ?? "").trim(),
    sku: (tag.attrs["data-sku"] ?? "").trim(),
    stock: (tag.attrs["data-stok"] ?? "").trim().toLowerCase(),
    images: [...new Set(images)],
  }
}

/**
 * VariantSku reads the option SKU of a variant link (-v-SKU).
 */
export function variantSku(url: string): string {
  try {
    const match = new URL(url.trim()).pathname.match(/-v-([^/]+)$/)
    return match ? decodeURIComponent(match[1] ?? "") : ""
  } catch {
    return ""
  }
}

function optionId(name: string | undefined): string {
  return name?.match(/^option\[(\d+)\]/)?.[1] ?? ""
}

function labelFor(section: string, id: string): string {
  for (const label of tags(section, "label")) {
    if (label.attrs.for === `input-option${id}`) {
      const close = section.indexOf("</label>", label.end)
      return stripTags(section.slice(label.end, close > 0 ? close : label.end)) || "Seçenek"
    }
  }

  return "Seçenek"
}

function lastLabel(html: string): string {
  const matches = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)]
  const last = matches.at(-1)

  return last ? stripTags(last[1] ?? "") : ""
}

function titleIndex(html: string): number {
  const index = html.search(/<h1\b/i)

  return index >= 0 ? index : 0
}

function attributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const pattern = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

  for (const match of source.matchAll(pattern)) {
    const name = (match[1] ?? "").toLowerCase()

    if (name && !(name in attrs)) {
      attrs[name] = match[2] ?? match[3] ?? match[4] ?? ""
    }
  }

  return attrs
}

function absolute(value: string, base: string): string | null {
  if (!value) {
    return null
  }

  try {
    const address = new URL(value, base)
    return address.protocol === "https:" || address.protocol === "http:" ? address.toString() : null
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}
