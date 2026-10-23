export function formatOrderReference(orderId: string): string {
  const normalized = String(orderId || "").trim()
  if (!normalized) return "#—"

  const compact = normalized.replace(/[^a-zA-Z0-9]/g, "")
  return `#${compact.slice(-4).toUpperCase()}`
}

export function normalizeOrderSearch(value: string): string {
  return String(value || "").trim().replace(/^#+/, "")
}
