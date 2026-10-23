import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatOrderAge(elapsedSeconds: number): {
  label: "NEW" | "AGING" | "DELAYED" | "STALE"
  display: string
  severity: "green" | "yellow" | "orange" | "red"
} {
  const minutes = Math.floor(elapsedSeconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  let display = ""
  if (minutes < 60) {
    display = `${minutes}m`
  } else if (hours < 24) {
    const remainingMinutes = minutes % 60
    display = `${hours}h ${remainingMinutes}m`
  } else {
    const remainingHours = hours % 24
    display = `${days}d ${remainingHours}h`
  }

  let severity: "green" | "yellow" | "orange" | "red" = "green"
  let label: "NEW" | "AGING" | "DELAYED" | "STALE" = "NEW"

  if (minutes < 15) {
    severity = "green"
    label = "NEW"
  } else if (minutes < 30) {
    severity = "yellow"
    label = "AGING"
  } else if (minutes < 60) {
    severity = "orange"
    label = "DELAYED"
  } else {
    severity = "red"
    label = "STALE"
  }

  return { display, severity, label }
}
