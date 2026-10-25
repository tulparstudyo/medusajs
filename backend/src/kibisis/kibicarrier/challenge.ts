import { randomBytes } from "crypto"

export type ChallengePurpose = "install" | "verify"

export type Challenge = {
  domain: string
  repo: string
  purpose: ChallengePurpose
}

const TTL_MS = 2 * 60_000
const pending = new Map<string, Challenge & { expires: number }>()

export const CHALLENGE_ID_PATTERN = /^[a-f0-9]{32}$/

/**
 * Opens a one-time challenge the license server reads back from
 * /kibisis/challenge/:id to prove this backend answers for the domain.
 * Challenges live in process memory, so the license server must reach the
 * same instance that sent the request.
 */
export function openChallenge(challenge: Challenge): string {
  const now = Date.now()

  for (const [id, entry] of pending) {
    if (entry.expires < now) {
      pending.delete(id)
    }
  }

  const id = randomBytes(16).toString("hex")
  pending.set(id, { ...challenge, expires: now + TTL_MS })

  return id
}

export function takeChallenge(id: string): Challenge | null {
  const entry = pending.get(id)
  pending.delete(id)

  if (!entry || entry.expires < Date.now()) {
    return null
  }

  return { domain: entry.domain, repo: entry.repo, purpose: entry.purpose }
}

export function closeChallenge(id: string): void {
  pending.delete(id)
}
