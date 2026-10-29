import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const LOCAL_UPLOAD_PATH = /^\/(?:products\/|sections\/|\d+-)/i
const LEGACY_LOCAL_CDN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/(?:products\/|sections\/|\d+-).*)$/i
const HTML_CDN_ATTR = /\b(src|href)=(["'])([^"']+)\2/gi

export function cdnUrl(): string {
  const configured = process.env.CDN_URL?.trim()
  const port = process.env.CDN_PORT?.trim() || "9080"
  const base = configured || `http://localhost:${port}`

  return base.replace(/\/+$/, "")
}

export function stripCdnUrl(value: string): string {
  if (!value) {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  const base = cdnUrl()
  if (base && trimmed.slice(0, base.length).toLowerCase() === base.toLowerCase()) {
    const rest = trimmed.slice(base.length)
    if (!rest) {
      return ""
    }
    if (rest.startsWith("/") || rest.startsWith("\\")) {
      const normalized = rest.replace(/\\/g, "/")
      return normalized.startsWith("/") ? normalized : `/${normalized}`
    }
  }

  const legacyMatch = LEGACY_LOCAL_CDN.exec(trimmed)
  if (legacyMatch?.[1]) {
    return legacyMatch[1].replace(/\\/g, "/")
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed.replace(/\\/g, "/")
  }

  return trimmed
}

export function resolveCdnUrl(value: string): string {
  if (!value) {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  const relative = stripCdnUrl(trimmed)
  if (relative.startsWith("/") && !relative.startsWith("//")) {
    return `${cdnUrl()}${relative}`
  }

  return trimmed
}

export function stripCdnFromHtml(html: string): string {
  if (!html) {
    return html
  }

  return html.replace(HTML_CDN_ATTR, (full, attr: string, quote: string, url: string) => {
    const stripped = stripCdnUrl(url)
    if (stripped !== url && LOCAL_UPLOAD_PATH.test(stripped)) {
      return `${attr}=${quote}${stripped}${quote}`
    }
    return full
  })
}

export function resolveCdnInHtml(html: string): string {
  if (!html) {
    return html
  }

  return html.replace(HTML_CDN_ATTR, (full, attr: string, quote: string, url: string) => {
    const stripped = stripCdnUrl(url)
    if (LOCAL_UPLOAD_PATH.test(stripped)) {
      return `${attr}=${quote}${resolveCdnUrl(stripped)}${quote}`
    }
    return full
  })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function transformSectionSettingsCdn<T>(
  settings: T,
  mode: "strip" | "resolve"
): T {
  if (!isPlainObject(settings)) {
    return settings
  }

  const convert = mode === "strip" ? stripCdnUrl : resolveCdnUrl
  const convertHtml = mode === "strip" ? stripCdnFromHtml : resolveCdnInHtml
  const next: Record<string, unknown> = { ...settings }

  if (Array.isArray(next.slides)) {
    next.slides = next.slides.map((slide) => {
      if (!isPlainObject(slide) || typeof slide.image !== "string") {
        return slide
      }
      return { ...slide, image: convert(slide.image) }
    })
  }

  if (Array.isArray(next.items)) {
    next.items = next.items.map((item) => {
      if (!isPlainObject(item) || typeof item.icon !== "string") {
        return item
      }
      return { ...item, icon: convert(item.icon) }
    })
  }

  if (typeof next.html === "string") {
    next.html = convertHtml(next.html)
  }

  return next as T
}

function transformImagesArray(images: unknown[], convert: (url: string) => string): unknown[] {
  return images.map((item) => {
    if (typeof item === "string") {
      return convert(item)
    }
    if (isPlainObject(item) && typeof item.url === "string") {
      return { ...item, url: convert(item.url) }
    }
    return item
  })
}

function transformFilesArray(files: unknown[], convert: (url: string) => string): unknown[] {
  return files.map((file) => {
    if (isPlainObject(file) && typeof file.url === "string") {
      return { ...file, url: convert(file.url) }
    }
    return file
  })
}

export function transformPayloadCdnUrls<T>(
  payload: T,
  mode: "strip" | "resolve",
  seen = new WeakSet<object>()
): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => transformPayloadCdnUrls(item, mode, seen)) as unknown as T
  }

  if (!isPlainObject(payload)) {
    return payload
  }

  if (seen.has(payload)) {
    return payload
  }
  seen.add(payload)

  const convert = mode === "strip" ? stripCdnUrl : resolveCdnUrl
  const next: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (key === "thumbnail" && typeof value === "string") {
      next[key] = convert(value)
    } else if (key === "images" && Array.isArray(value)) {
      next[key] = transformImagesArray(value, convert)
    } else if (key === "files" && Array.isArray(value)) {
      next[key] = transformFilesArray(value, convert)
    } else if (key === "file" && isPlainObject(value) && typeof value.url === "string") {
      next[key] = { ...value, url: convert(value.url) }
    } else if (key === "settings" && isPlainObject(value)) {
      next[key] = transformSectionSettingsCdn(value, mode)
    } else if (Array.isArray(value) || isPlainObject(value)) {
      next[key] = transformPayloadCdnUrls(value, mode, seen)
    } else {
      next[key] = value
    }
  }

  return next as T
}

export function cdnUrlMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.body && typeof req.body === "object") {
    req.body = transformPayloadCdnUrls(req.body, "strip")
  }
  if (req.validatedBody && typeof req.validatedBody === "object") {
    req.validatedBody = transformPayloadCdnUrls(req.validatedBody, "strip")
  }

  const originalJson = res.json.bind(res)
  res.json = ((body: unknown) => {
    return originalJson(transformPayloadCdnUrls(body, "resolve"))
  }) as typeof res.json

  next()
}
