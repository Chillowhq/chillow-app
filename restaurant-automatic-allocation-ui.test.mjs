import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const publicPageUrl = new URL(
  "./app/reserve/[countryCode]/[businessSlug]/page.tsx",
  import.meta.url,
)
const staffDialogUrl = new URL(
  "./components/reservations/dashboard/StaffRestaurantReservationDialog.tsx",
  import.meta.url,
)

test("public restaurant booking uses canonical allocatable availability", async () => {
  const page = await readFile(publicPageUrl, "utf8")
  assert.match(page, /\/public\/reservations\/restaurant-availability/)
  assert.match(page, /availableStartTimes/)
  assert.match(page, /validEndTimes/)
  assert.match(page, /servicePoints:/)
  assert.match(page, /noPreferenceAvailable/)
  assert.match(page, /countryCode/)
})

test("public restaurant booking restores the table-selection step", async () => {
  const page = await readFile(publicPageUrl, "utf8")
  assert.match(page, /Choose your table/)
  assert.match(page, /No preference/)
  assert.match(page, /availableServicePoints\.map/)
  assert.match(page, /servicePoint\.label/)
  assert.match(page, /Seats up to/)
  const partyStep = page.indexOf("Number of Guests")
  const tableStep = page.indexOf("Choose your table")
  const contactStep = page.indexOf("<GuestDetailsForm", tableStep)
  assert.ok(partyStep < tableStep)
  assert.ok(tableStep < contactStep)
})

test("guest can request a specific table or No preference", async () => {
  const page = await readFile(publicPageUrl, "utf8")
  assert.match(page, /seatingPreference: "no_preference"/)
  assert.match(page, /servicePointId: formData\.servicePointId \|\| null/)
  assert.match(page, /servicePointId: servicePoint\.servicePointId/)
  assert.match(page, /servicePointId: ""/)
  assert.doesNotMatch(page, /servicePointLabel/)
})

test("party and interval changes revalidate the selected table", async () => {
  const page = await readFile(publicPageUrl, "utf8")
  assert.match(page, /data\.servicePoints\.some/)
  assert.match(page, /point\.servicePointId === current\.servicePointId/)
  assert.match(page, /return \{ \.\.\.current, servicePointId: "" \}/)
  assert.match(page, /formData\.guestCount/)
  assert.match(page, /formData\.date/)
  assert.match(page, /formData\.durationMinutes/)
  assert.match(page, /formData\.startTime/)
})

test("a stale table conflict is recoverable and refreshes canonical availability", async () => {
  const page = await readFile(publicPageUrl, "utf8")
  assert.match(page, /That table is no longer available/)
  assert.match(page, /choose another table or No preference/i)
  assert.match(page, /setAvailabilityRefreshVersion/)
  assert.match(page, /setStep\(1\)/)
})

test("confirmation uses the selected label rather than exposing an internal id", async () => {
  const page = await readFile(publicPageUrl, "utf8")
  assert.match(page, /label: "Table preference"/)
  assert.match(page, /selectedServicePoint\?\.label \|\| "No preference"/)
  assert.doesNotMatch(page, /label: "servicePointId"/)
  assert.doesNotMatch(page, /value: formData\.servicePointId/)
})

test("public and staff reservation creates retain a stable idempotency key", async () => {
  const [page, dialog] = await Promise.all([
    readFile(publicPageUrl, "utf8"),
    readFile(staffDialogUrl, "utf8"),
  ])
  for (const source of [page, dialog]) {
    assert.match(source, /reservationAttemptRef/)
    assert.match(source, /crypto\.randomUUID\(\)/)
    assert.match(source, /"Idempotency-Key"/)
    assert.match(source, /fingerprint/)
  }
})

test("staff reservations offer automatic assignment while preserving explicit owner control", async () => {
  const dialog = await readFile(staffDialogUrl, "utf8")
  assert.match(dialog, /Automatic assignment/)
  assert.match(dialog, /servicePointId: form\.servicePointId \|\| null/)
  assert.match(dialog, /seatingPreference: "no_preference"/)
  assert.doesNotMatch(dialog, />\s*No preference\s*</)
})
