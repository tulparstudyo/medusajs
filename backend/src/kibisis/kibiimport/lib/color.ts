const COLOR_LABELS = ["renk", "color", "colour", "цвет", "اللون"]

export function isColorLabel(name: string): boolean {
  return COLOR_LABELS.includes(name.trim().toLowerCase())
}
