import { timingSafeEqual } from "crypto"

import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

function secretsMatch(expected: string, provided: string) {
  const left = new TextEncoder().encode(expected)
  const right = new TextEncoder().encode(provided)
  if (left.byteLength !== right.byteLength) {
    return false
  }

  return timingSafeEqual(left, right)
}

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    return NextResponse.json(
      { message: "Revalidate secret is not configured" },
      { status: 503 }
    )
  }

  const provided = req.headers.get("x-revalidate-secret") ?? ""
  if (!secretsMatch(secret, provided)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  revalidateTag("products", { expire: 0 })

  return NextResponse.json({ revalidated: true })
}
