import { ReactNode } from "react"

export default function Shell({ children }: { children: ReactNode; cart?: unknown }) {
  return <>{children}</>
}
