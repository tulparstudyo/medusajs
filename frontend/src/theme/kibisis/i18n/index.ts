import { en, type MessageKey, type Messages } from "./messages/en"
import { ru } from "./messages/ru"
import { tr } from "./messages/tr"

export type { MessageKey, Messages }

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

const CATALOG: Record<string, Messages> = { en, tr, ru }

export function messagesFor(locale: string | null | undefined): Messages {
  const language = (locale ?? "").toLowerCase().split(/[-_]/)[0]
  return CATALOG[language] ?? en
}

export function makeTranslate(messages: Messages): Translate {
  return (key, vars) => {
    const text = messages[key] ?? en[key] ?? key
    return vars ? text.replace(/\{(\w+)\}/g, (match, name) => String(vars[name] ?? match)) : text
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

/**
 * Replaces `{{t:key}}` placeholders in section HTML templates.
 */
export function translateTemplate(template: string, t: Translate) {
  return template.replace(/\{\{t:([\w.]+)\}\}/g, (_, key: string) =>
    escapeHtml(t(key as MessageKey))
  )
}
