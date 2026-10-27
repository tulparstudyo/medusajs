import "server-only"

import { getLocale } from "@lib/data/locale-actions"
import { DEFAULT_LOCALE } from "@lib/util/default-locale"

import { makeTranslate, messagesFor } from "."

export async function getKibiI18n() {
  const locale = (await getLocale()) || DEFAULT_LOCALE
  const messages = messagesFor(locale)
  return { locale, messages, t: makeTranslate(messages) }
}
