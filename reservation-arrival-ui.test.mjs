import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const arrivalPageUrl = new URL(
  "./app/reservation/arrival/page.tsx",
  import.meta.url,
)
const dashboardUrl = new URL(
  "./components/reservations/RestaurantReservationsDashboard.tsx",
  import.meta.url,
)
const dashboardHookUrl = new URL(
  "./components/reservations/dashboard/useReservationDashboard.ts",
  import.meta.url,
)

test("guest arrival page validates and checks in with the opaque token only", async () => {
  const page = await readFile(arrivalPageUrl, "utf8")

  assert.match(page, /searchParams\.get\("token"\)/)
  assert.match(page, /\/public\/reservations\/arrival\/validate/)
  assert.match(page, /\/public\/reservations\/arrival\/check-in/)
  assert.match(page, /\{ token \}/)
  assert.doesNotMatch(page, /reservationId/)
  assert.match(page, /onClick=\{checkIn\}/)
  assert.match(page, /useEffect\(\(\) => \{\s*void validateToken\(\)/)
})

test("guest arrival page exposes every required friendly outcome", async () => {
  const page = await readFile(arrivalPageUrl, "utf8")

  assert.match(page, /You're checked in!/)
  assert.match(page, /We've notified the restaurant that you've arrived/)
  assert.match(page, /Please wait to be seated/)
  assert.match(page, /You're already checked in\./)
  assert.match(page, /This reservation is no longer active\./)
  assert.match(page, /This check-in link has expired\./)
  assert.match(page, /Arrival check-in is temporarily unavailable\./)
})

test("restaurant dashboard reconciles arrival SSE and highlights arrived guests", async () => {
  const [dashboard, hook] = await Promise.all([
    readFile(dashboardUrl, "utf8"),
    readFile(dashboardHookUrl, "utf8"),
  ])

  assert.match(hook, /useEventSource/)
  assert.match(hook, /role=reservations/)
  assert.match(hook, /reservation_arrived/)
  assert.match(hook, /arrived: \{ label: "Arrived"/)
  assert.match(hook, /reservation\.status === "arrived"/)

  assert.match(dashboard, /Arrived/)
  assert.match(dashboard, /value="arrived"/)
  assert.doesNotMatch(
    dashboard,
    /nextStatuses:[\s\S]*?confirmed:\s*\[[^\]]*"arrived"/,
  )
})
