"use strict"

const fs = require("fs")
const http = require("http")
const path = require("path")
const sharp = require("sharp")

try {
  process.loadEnvFile(path.join(__dirname, ".env"))
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error
  }
}

const ROOT = path.resolve(process.env.CDN_DIR || path.join(__dirname, "files"))
const RESIZED_ROOT = path.resolve(
  process.env.CDN_RESIZED_DIR || path.join(__dirname, "resized")
)
const PORT = Number(process.env.CDN_PORT || 9080)
const HOST = process.env.CDN_HOST || undefined

const MAX_DIMENSION = 4096
const RESIZABLE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
])
const VALID_FITS = new Set(["cover", "contain", "fill", "inside", "outside"])
const VALID_FORMATS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"])

const TYPES = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

const SECURITY_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Security-Policy":
    "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Content-Type-Options": "nosniff",
}

const inFlightResizes = new Map()
let tmpCounter = 0

function send(res, status, headers = {}, body = "") {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers })
  res.end(body)
}

function parseRequestUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl, "http://cdn")
  } catch {
    return null
  }

  let pathname
  try {
    pathname = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }

  if (pathname.includes("\0")) {
    return null
  }

  const segments = pathname.split(/[\\/]+/).filter(Boolean)
  if (!segments.length || segments.some((segment) => segment.startsWith("."))) {
    return null
  }

  const filePath = path.resolve(ROOT, ...segments)
  const relative = path.relative(ROOT, filePath)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null
  }

  return {
    filePath,
    relative,
    searchParams: parsed.searchParams,
  }
}

function parsePositiveInt(raw, min, max) {
  if (raw === null || raw === undefined || raw === "") {
    return null
  }
  if (!/^\d+$/.test(String(raw).trim())) {
    return NaN
  }
  const num = Number(raw)
  if (!Number.isInteger(num) || num < min || num > max) {
    return NaN
  }
  return num
}

function parseResizeOptions(searchParams, ext) {
  if (!RESIZABLE_EXTENSIONS.has(ext)) {
    return { options: null, error: null }
  }

  const rawWidth = searchParams.get("w") ?? searchParams.get("width")
  const rawHeight = searchParams.get("h") ?? searchParams.get("height")
  const rawQuality = searchParams.get("q") ?? searchParams.get("quality")
  const rawFit = searchParams.get("fit")
  const rawFormat = searchParams.get("fm") ?? searchParams.get("format")

  const hasAnyParam =
    rawWidth !== null ||
    rawHeight !== null ||
    rawQuality !== null ||
    rawFit !== null ||
    rawFormat !== null

  if (!hasAnyParam) {
    return { options: null, error: null }
  }

  const width = parsePositiveInt(rawWidth, 1, MAX_DIMENSION)
  const height = parsePositiveInt(rawHeight, 1, MAX_DIMENSION)
  const quality = parsePositiveInt(rawQuality, 1, 100)

  if (Number.isNaN(width) || Number.isNaN(height) || Number.isNaN(quality)) {
    return { options: null, error: "Invalid numeric resize parameter" }
  }

  let fit = null
  if (rawFit !== null && rawFit !== "") {
    const normalizedFit = rawFit.trim().toLowerCase()
    if (!VALID_FITS.has(normalizedFit)) {
      return { options: null, error: "Invalid fit parameter" }
    }
    fit = normalizedFit
  }

  let format = null
  if (rawFormat !== null && rawFormat !== "") {
    const normalizedFormat = rawFormat.trim().toLowerCase()
    if (!VALID_FORMATS.has(normalizedFormat)) {
      return { options: null, error: "Invalid format parameter" }
    }
    format = normalizedFormat === "jpg" ? "jpeg" : normalizedFormat
  }

  if (!width && !height && !quality && !format) {
    return { options: null, error: null }
  }

  return {
    options: {
      width,
      height,
      quality: 100,
      fit: fit || (width && height ? "cover" : "inside"),
      format,
    },
    error: null,
  }
}

function resolveResizedPath(relativePath, options) {
  const dir = path.dirname(relativePath)
  const origExt = path.extname(relativePath)
  const base = path.basename(relativePath, origExt)

  const parts = []
  if (options.width) parts.push(`w${options.width}`)
  if (options.height) parts.push(`h${options.height}`)
  if (options.width || options.height) parts.push(`f-${options.fit}`)
  parts.push(`q${options.quality}`)

  const targetExt = options.format
    ? options.format === "jpeg"
      ? ".jpg"
      : `.${options.format}`
    : origExt.toLowerCase()

  const fileName = `${base}__${parts.join("_")}${targetExt}`
  const resizedPath = path.resolve(RESIZED_ROOT, dir, fileName)
  const relCheck = path.relative(RESIZED_ROOT, resizedPath)

  if (!relCheck || relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
    return null
  }

  return resizedPath
}

async function generateResizedImage(sourcePath, targetPath, origExt, options) {
  const existingJob = inFlightResizes.get(targetPath)
  if (existingJob) {
    return existingJob
  }

  const job = (async () => {
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })

    const animated = origExt === ".gif" || origExt === ".webp"
    let pipeline = sharp(sourcePath, { animated }).rotate()

    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width || undefined,
        height: options.height || undefined,
        fit: options.fit,
        withoutEnlargement: true,
      })
    }

    const effectiveFormat =
      options.format ||
      (origExt === ".jpg" ? "jpeg" : origExt.slice(1).toLowerCase())

    const formatOptions = { quality: 100 }
    switch (effectiveFormat) {
      case "jpeg":
        pipeline = pipeline.jpeg(formatOptions)
        break
      case "png":
        pipeline = pipeline.png(formatOptions)
        break
      case "webp":
        pipeline = pipeline.webp(formatOptions)
        break
      case "avif":
        pipeline = pipeline.avif(formatOptions)
        break
      case "gif":
        pipeline = pipeline.gif()
        break
    }

    const tmpPath = `${targetPath}.${process.pid}.${++tmpCounter}.tmp`
    try {
      await pipeline.toFile(tmpPath)
      await fs.promises.rename(tmpPath, targetPath)
    } catch (error) {
      await fs.promises.unlink(tmpPath).catch(() => {})
      throw error
    }

    return fs.promises.stat(targetPath)
  })()

  inFlightResizes.set(targetPath, job)
  try {
    return await job
  } finally {
    inFlightResizes.delete(targetPath)
  }
}

function isFresh(req, etag, mtime) {
  const noneMatch = req.headers["if-none-match"]
  if (noneMatch) {
    return noneMatch
      .split(",")
      .map((value) => value.trim())
      .some((value) => value === etag || value === "*")
  }

  const modifiedSince = Date.parse(req.headers["if-modified-since"] || "")
  return (
    Number.isFinite(modifiedSince) &&
    Math.floor(mtime.getTime() / 1000) * 1000 <= modifiedSince
  )
}

function serveFile(req, res, filePath, stats, extraHeaders = {}) {
  const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`
  const headers = {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type":
      TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    ETag: etag,
    "Last-Modified": stats.mtime.toUTCString(),
    ...extraHeaders,
  }

  if (isFresh(req, etag, stats.mtime)) {
    send(res, 304, headers)
    return
  }

  res.writeHead(200, {
    ...SECURITY_HEADERS,
    ...headers,
    "Content-Length": stats.size,
  })

  if (req.method === "HEAD") {
    res.end()
    return
  }

  const stream = fs.createReadStream(filePath)
  stream.on("error", () => res.destroy())
  stream.pipe(res)
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, { Allow: "GET, HEAD" })
    return
  }

  const parsed = parseRequestUrl(req.url || "/")
  if (!parsed) {
    send(res, 404)
    return
  }

  const { filePath, relative, searchParams } = parsed
  const origExt = path.extname(filePath).toLowerCase()
  const { options: resizeOptions, error: resizeError } = parseResizeOptions(
    searchParams,
    origExt
  )

  if (resizeError) {
    send(
      res,
      400,
      { "Content-Type": "text/plain; charset=utf-8" },
      resizeError
    )
    return
  }

  if (!resizeOptions) {
    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) {
        send(res, 404)
        return
      }
      serveFile(req, res, filePath, stats)
    })
    return
  }

  const resizedPath = resolveResizedPath(relative, resizeOptions)
  if (!resizedPath) {
    send(res, 400)
    return
  }

  try {
    const [origStats, cachedStats] = await Promise.all([
      fs.promises.stat(filePath).catch(() => null),
      fs.promises.stat(resizedPath).catch(() => null),
    ])

    // Eğer resize edilmiş görsel özel klasörde varsa ve güncel ise doğrudan buradan yayınla
    if (
      cachedStats &&
      cachedStats.isFile() &&
      (!origStats ||
        (origStats.isFile() && cachedStats.mtimeMs >= origStats.mtimeMs))
    ) {
      serveFile(req, res, resizedPath, cachedStats, { "X-CDN-Cache": "HIT" })
      return
    }

    if (!origStats || !origStats.isFile()) {
      send(res, 404)
      return
    }

    const resizedStats = await generateResizedImage(
      filePath,
      resizedPath,
      origExt,
      resizeOptions
    )
    serveFile(req, res, resizedPath, resizedStats, { "X-CDN-Cache": "MISS" })
  } catch (error) {
    console.error(`Resize error for ${relative}:`, error.message)
    send(res, 500)
  }
})

server.on("error", (error) => {
  console.error(`CDN could not start on port ${PORT}: ${error.message}`)
  process.exit(1)
})

fs.mkdirSync(ROOT, { recursive: true })
fs.mkdirSync(RESIZED_ROOT, { recursive: true })

server.listen(PORT, HOST, () => {
  console.log(
    `CDN ready on http://${HOST || "localhost"}:${PORT} serving ${ROOT} (resized cache: ${RESIZED_ROOT})`
  )
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
