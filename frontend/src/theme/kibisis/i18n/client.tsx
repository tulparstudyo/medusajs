"use client"

import { createContext, ReactNode, useCallback, useContext, useMemo } from "react"

import { DEFAULT_LOCALE } from "@lib/util/default-locale"

import { formatMoney, type FormatMoney } from "../money"
import { makeTranslate, type Messages, type Translate } from "."
import { en } from "./messages/en"

const MessagesContext = createContext<Messages>(en)
const LocaleContext = createContext<string>(DEFAULT_LOCALE)

export function KibiI18nProvider({
  messages,
  locale,
  children,
}: {
  messages: Messages
  locale: string
  children: ReactNode
}) {
  return (
    <LocaleContext.Provider value={locale}>
      <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>
    </LocaleContext.Provider>
  )
}

export function useT(): Translate {
  const messages = useContext(MessagesContext)
  return useMemo(() => makeTranslate(messages), [messages])
}

export function useMoney(): FormatMoney {
  const locale = useContext(LocaleContext)
  return useCallback((amount, currency) => formatMoney(amount, currency, locale), [locale])
}
