export function formatCountdown(estimatedReadyAt?: string | Date | null, nowMs = Date.now()): string {
  if (!estimatedReadyAt) return "00:00"

  const readyAtMs = estimatedReadyAt instanceof Date
    ? estimatedReadyAt.getTime()
    : Date.parse(estimatedReadyAt)

  if (!Number.isFinite(readyAtMs)) return "00:00"

  const diffMs = Math.max(0, readyAtMs - nowMs)
  const totalSeconds = Math.floor(diffMs / 1000)
  
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (num: number) => num.toString().padStart(2, "0")

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

export function formatAbsoluteTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function isPastEta(estimatedReadyAt?: string | Date | null, nowMs = Date.now()): boolean {
  if (!estimatedReadyAt) return false
  const readyAtMs = estimatedReadyAt instanceof Date
    ? estimatedReadyAt.getTime()
    : Date.parse(estimatedReadyAt)

  return Number.isFinite(readyAtMs) && readyAtMs <= nowMs
}