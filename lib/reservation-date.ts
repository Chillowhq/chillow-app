type ReservationDateMonthStyle = "short" | "long"

export function getBusinessLocalReservationDate(
  timezone = "UTC",
  value = new Date(),
) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value)
    const partValues = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    )

    return `${partValues.year}-${partValues.month}-${partValues.day}`
  } catch {
    return value.toISOString().slice(0, 10)
  }
}

export function addReservationDateDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number)
  if (![year, month, day, days].every(Number.isFinite)) return ""

  const shiftedDate = new Date(Date.UTC(year, month - 1, day + days))
  return shiftedDate.toISOString().slice(0, 10)
}

function formatDateOnly(
  value: string | null | undefined,
  month: ReservationDateMonthStyle,
  fallback: string,
) {
  if (!value) return fallback

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month,
    day: "numeric",
    year: "numeric",
  })
}

export function formatReservationDate(
  value: string | null | undefined,
  fallback = "—",
) {
  return formatDateOnly(value, "short", fallback)
}

export function formatOptionalReservationDate(
  value: string | null | undefined,
) {
  return formatDateOnly(value, "short", "")
}

export function formatLongReservationDate(
  value: string | null | undefined,
  fallback = "—",
) {
  return formatDateOnly(value, "long", fallback)
}

export function getReservationNights(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
) {
  if (!checkIn || !checkOut) return 0

  const start = new Date(`${checkIn}T00:00:00`)
  const end = new Date(`${checkOut}T00:00:00`)
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  )
}

export function formatReservationTime(value: string | null | undefined) {
  if (!value) return "—"

  const [hours, minutes] = value.split(":").map(Number)
  const period = hours >= 12 ? "PM" : "AM"
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${period}`
}

export function isReservationToday(value: string | null | undefined) {
  return Boolean(value && value === new Date().toISOString().split("T")[0])
}

export function isReservationUpcoming(value: string | null | undefined) {
  return Boolean(value && new Date(`${value}T00:00:00`) > new Date())
}
