import AccountLayout from "./default/account/account-layout"
import LoginTemplate from "./default/account/login-template"
import CartTemplate from "./default/cart"
import CategoryTemplate from "./default/categories"
import CheckoutForm from "./default/checkout/checkout-form"
import CheckoutSummary from "./default/checkout/checkout-summary"
import CollectionTemplate from "./default/collections"
import Home from "./default/home"
import Footer from "./default/layout/footer"
import Nav from "./default/layout/nav"
import Shell from "./default/layout/shell"
import OrderCompletedTemplate from "./default/order/order-completed-template"
import OrderDetailsTemplate from "./default/order/order-details-template"
import ProductTemplate from "./default/products"
import StoreTemplate from "./default/store"
import KibisisCartTemplate from "./kibisis/cart"
import KibisisCategoryTemplate from "./kibisis/categories"
import KibisisHome from "./kibisis/home"
import KibisisProductTemplate from "./kibisis/products"
import KibisisStaticPage from "@modules/kibipage"
import KibisisAccountLayout from "./kibisis/account/account-layout"
import KibisisLoginTemplate from "./kibisis/account/login-template"
import KibisisFooter from "./kibisis/layout/footer"
import KibisisNav from "./kibisis/layout/nav"
import KibisisShell from "./kibisis/layout/shell"

const defaultTheme = {
  account: {
    layout: AccountLayout,
    login: LoginTemplate,
  },
  cart: CartTemplate,
  categories: CategoryTemplate,
  checkout: {
    form: CheckoutForm,
    summary: CheckoutSummary,
  },
  collections: CollectionTemplate,
  home: Home,
  layout: {
    footer: Footer,
    nav: Nav,
    shell: Shell,
  },
  order: {
    completed: OrderCompletedTemplate,
    details: OrderDetailsTemplate,
  },
  products: ProductTemplate,
  staticPage: KibisisStaticPage,
  store: StoreTemplate,
}

const themes = {
  default: defaultTheme,
  kibisis: {
    ...defaultTheme,
    account: {
      layout: KibisisAccountLayout,
      login: KibisisLoginTemplate,
    },
    cart: KibisisCartTemplate,
    categories: KibisisCategoryTemplate,
    home: KibisisHome,
    products: KibisisProductTemplate,
    staticPage: KibisisStaticPage,
    layout: {
      footer: KibisisFooter,
      nav: KibisisNav,
      shell: KibisisShell,
    },
  },
}

export type ThemeName = keyof typeof themes

const themeName = (process.env.NEXT_PUBLIC_THEME ?? "default") as ThemeName

export const theme = themes[themeName] ?? themes.default
