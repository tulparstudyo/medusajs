"use strict"

const fs = require("fs")
const http = require("http")
const path = require("path")

try {
  process.loadEnvFile(path.join(__dirname, ".env"))
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error
  }
}

const ROOT = path.resolve(process.env.CDN_DIR || path.join(__dirname, "files"))
const PORT = Number(process.env.CDN_PORT || 9080)
const HOST = process.env.CDN_HOST || undefined

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
  "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Content-Type-Options": "nosniff",
}

function send(res, status, headers = {}, body = "") {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers })
  res.end(body)
}

function resolveFile(rawUrl) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(rawUrl, "http://cdn").pathname)
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

  return filePath
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
  return Number.isFinite(modifiedSince) && Math.floor(mtime.getTime() / 1000) * 1000 <= modifiedSince
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, { Allow: "GET, HEAD" })
    return
  }

  const filePath = resolveFile(req.url || "/")
  if (!filePath) {
    send(res, 404)
    return
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      send(res, 404)
      return
    }

    const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`
    const headers = {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      ETag: etag,
      "Last-Modified": stats.mtime.toUTCString(),
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
  })
})

server.on("error", (error) => {
  console.error(`CDN could not start on port ${PORT}: ${error.message}`)
  process.exit(1)
})

fs.mkdirSync(ROOT, { recursive: true })

server.listen(PORT, HOST, () => {
  console.log(`CDN ready on http://${HOST || "localhost"}:${PORT} serving ${ROOT}`)
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
