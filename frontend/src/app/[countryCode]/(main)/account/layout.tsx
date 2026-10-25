import { retrieveCustomer } from "@lib/data/customer"
// TODO: Re-add Toaster component when needed
import { theme } from "@theme"

const AccountLayout = theme.account.layout

export default async function AccountPageLayout({
  dashboard,
  login,
}: {
  dashboard?: React.ReactNode
  login?: React.ReactNode
}) {
  const customer = await retrieveCustomer().catch(() => null)

  return (
    <AccountLayout customer={customer}>
      {customer ? dashboard : login}
      {/* TODO: Re-add Toaster component when needed */}
    </AccountLayout>
  )
}
