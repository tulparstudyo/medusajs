import { Metadata } from "next"

import { theme } from "@theme"

const LoginTemplate = theme.account.login

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Medusa Store account.",
}

export default function Login() {
  return <LoginTemplate />
}
