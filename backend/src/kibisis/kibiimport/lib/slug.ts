const TURKISH: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
}

export function slugify(value: string): string {
  const lower = value.trim().toLocaleLowerCase("tr-TR")
  let mapped = ""

  for (const char of lower) {
    mapped += TURKISH[char] ?? char
  }

  const slug = mapped
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return slug || "urun"
}
