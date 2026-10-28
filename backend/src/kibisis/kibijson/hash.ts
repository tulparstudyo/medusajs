import { createHash } from "crypto"

/** StableJson writes object keys sorted, so the same document always hashes the same. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`
  }

  return JSON.stringify(value) ?? "null"
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}
