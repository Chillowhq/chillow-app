import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const dashboardUrl = new URL(
  "./components/reservations/RestaurantReservationsDashboard.tsx",
  import.meta.url,
)
const todayViewUrl = new URL(
  "./components/reservations/dashboard/restaurant/RestaurantTodayView.tsx",
  import.meta.url,
)
const actionsUrl = new URL(
  "./components/reservations/dashboard/RestaurantReservationActions.tsx",
  import.meta.url,
)
const dialogUrl = new URL(
  "./components/reservations/dashboard/StaffRestaurantReservationDialog.tsx",
  import.meta.url,
)
const hookUrl = new URL(
  "./components/reservations/dashboard/useReservationDashboard.ts",
  import.meta.url,
)

test("restaurant dashboard exposes the operational Today workspace", async () => {
  const [dashboard, todayView] = await Promise.all([
    readFile(dashboardUrl, "utf8"),
    readFile(todayViewUrl, "utf8"),
  ])

  for (const label of [
    "Expected Today",
    "Arrived",
    "Seated Now",
    "Available Tonight",
    "Needs Attention",
    "Service point Availability",
    "Quick Actions",
    "Quiet Period",
  ]) {
    assert.match(`${dashboard}\n${todayView}`, new RegExp(label))
  }
  assert.match(todayView, /Today&apos;s Reservations/)

  assert.match(dashboard, /id: "today"/)
  assert.match(dashboard, /id: "calendar"/)
  assert.match(dashboard, /id: "all"/)
  assert.match(dashboard, /setOperationalDate/)
})

test("restaurant lifecycle supports arrival, seating and completion", async () => {
  const [actions, hook] = await Promise.all([
    readFile(actionsUrl, "utf8"),
    readFile(hookUrl, "utf8"),
  ])

  assert.match(actions, /label: "Mark Arrived"/)
  assert.match(actions, /label: "Seat Guest"/)
  assert.match(actions, /status: "seated"/)
  assert.match(actions, /label: "Complete Visit"/)
  assert.match(actions, /status: "completed"/)
  assert.match(hook, /reservation_seated/)
  assert.match(hook, /reservation_completed/)
})

test("staff reservation dialog creates only through the authenticated owner endpoint", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /apiClient\.get<RestaurantAvailability>\("\/owner\/reservations\/restaurant-availability"/)
  assert.match(dialog, /apiClient\.post\("\/owner\/reservations"/)
  assert.match(dialog, /seatNow: isWalkIn/)
  assert.match(dialog, /servicePointId: form\.servicePointId \|\| null/)
  assert.doesNotMatch(dialog, /businessId:/)
})

test("owner restaurant choices are rendered from authoritative availability", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /availableDates/)
  assert.match(dialog, /availableStartTimes\.map/)
  assert.match(dialog, /validEndTimes\.map/)
  assert.match(dialog, /availability\?\.servicePoints\.map/)
  assert.match(dialog, /noPreferenceAvailable/)
  assert.match(dialog, /selectedServicePointAvailable/)
  assert.match(dialog, /durationMinutes: form\.durationMinutes/)
  assert.doesNotMatch(dialog, /type="date"/)
  assert.doesNotMatch(dialog, /type="time"/)
  assert.doesNotMatch(dialog, /<select/)
})

test("dependent selections clear explicitly and stale conflicts refresh without erasing guest fields", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /startTime: "",\s*endTime: ""/)
  assert.match(dialog, /endTime: "",\s*durationMinutes: DEFAULT_DURATION_MINUTES/)
  assert.match(dialog, /data\.availableStartTimes\.includes\(current\.startTime\)/)
  assert.match(dialog, /data\.validEndTimes\.includes\(current\.endTime\)/)
  assert.match(dialog, /requestError\.response\?\.status === 409/)
  assert.match(dialog, /Your guest details are preserved/)
  assert.match(dialog, /setRefreshVersion/)
  assert.match(dialog, /setForm\(\(current\) => \(\{ \.\.\.current, endTime: "" \}\)\)/)
})

test("availability loading, empty, error, mobile and keyboard-accessible states are present", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /Loading current availability/)
  assert.match(dialog, /No times are currently available/)
  assert.match(dialog, /Availability could not be loaded/)
  assert.match(dialog, /w-\[min\(21rem,calc\(100vw-2rem\)\)\]/)
  assert.match(dialog, /max-h-\[calc\(100vh-2rem\)\]/)
  assert.match(dialog, /aria-label="Previous month"/)
  assert.match(dialog, /aria-label="Next month"/)
  assert.match(dialog, /aria-label="Start time"/)
  assert.match(dialog, /aria-label="End time"/)
  assert.match(dialog, /aria-label="Service point"/)
})
