export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("accept", "application/json")

  if (init?.body) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(path, { ...init, headers })
  const text = await response.text()
  let body: { message?: string } | null = null

  if (text) {
    try {
      body = JSON.parse(text) as { message?: string }
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, body?.message || "İstek tamamlanamadı.")
  }

  return body as T
}
