import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { ImportException } from "./errors"

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

const MAX_BYTES = 30 * 1024 * 1024

export type RemoteResponse = {
  status: number
  body: Buffer
  mediaType: string
}

/**
 * RemoteGet downloads a public http address. Some storefronts reject the
 * runtime HTTP client, so a blocked response is tried again with curl.
 */
export async function remoteGet(url: string, accept = "*/*"): Promise<RemoteResponse> {
  assertHttp(url)

  let response: RemoteResponse

  try {
    response = await viaFetch(url, accept)
  } catch {
    response = { status: 0, body: Buffer.alloc(0), mediaType: "" }
  }

  if (response.status === 0 || response.status === 403) {
    response = await viaCurl(url, accept)
  }

  if (response.body.length > MAX_BYTES) {
    throw new ImportException("İndirilen dosya çok büyük.")
  }

  return response
}

function assertHttp(url: string): void {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new ImportException("Yalnızca http linkleri indirilebilir.")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ImportException("Yalnızca http linkleri indirilebilir.")
  }
}

async function viaFetch(url: string, accept: string): Promise<RemoteResponse> {
  const response = await fetch(url, {
    headers: {
      accept,
      "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
      "user-agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  })
  const body = Buffer.from(await response.arrayBuffer())

  return {
    status: response.status,
    body,
    mediaType: mediaType(response.headers.get("content-type") ?? ""),
  }
}

async function viaCurl(url: string, accept: string): Promise<RemoteResponse> {
  const directory = await mkdtemp(join(tmpdir(), "kibiimport-"))
  const bodyFile = join(directory, "body")
  const headerFile = join(directory, "headers")
  const binary = process.platform === "win32" ? "C:\\Windows\\System32\\curl.exe" : "curl"

  try {
    await exec(binary, [
      "-sS",
      "-L",
      "--max-time",
      "30",
      "--proto",
      "=http,https",
      "--proto-redir",
      "=http,https",
      "-A",
      USER_AGENT,
      "-H",
      `Accept: ${accept}`,
      "-H",
      "Accept-Language: tr-TR,tr;q=0.9,en;q=0.8",
      "-D",
      headerFile,
      "-o",
      bodyFile,
      url,
    ])

    const headers = await readFile(headerFile, "utf8")
    const body = await readFile(bodyFile)

    return {
      status: lastStatus(headers),
      body,
      mediaType: mediaType(headerValue(headers, "content-type")),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "İndirme başarısız oldu."
    throw new ImportException(`İndirme başarısız oldu: ${message}`)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function exec(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 40_000, windowsHide: true }, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function lastStatus(headers: string): number {
  const matches = [...headers.matchAll(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/gm)]
  const last = matches.at(-1)

  return last ? Number(last[1]) : 0
}

function headerValue(headers: string, name: string): string {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, "im")
  const match = headers.match(pattern)

  return match?.[1]?.trim() ?? ""
}

function mediaType(header: string): string {
  return header.split(";")[0]?.trim().toLowerCase() ?? ""
}
