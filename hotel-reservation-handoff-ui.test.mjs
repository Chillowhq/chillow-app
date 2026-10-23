import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const hotelFlowUrl = new URL(
  "./components/reservations/hotel/HotelReservationFlow.tsx",
  import.meta.url,
)
const prefillUrl = new URL("./lib/hotel-reservation-prefill.ts", import.meta.url)

test("hotel handoff consumes only validated query preferences before availability", async () => {
  const flow = await readFile(hotelFlowUrl, "utf8")

  assert.match(flow, /useSearchParams/)
  assert.match(flow, /parseHotelReservationPrefill\(searchParams, \{\s*businessLocalToday: today/)
  assert.match(
    flow,
    /\/public\/reservations\/available-rooms[\s\S]*params:\s*\{ countryCode, businessSlug, checkInDate, checkOutDate, guestCount \}/,
  )

  const effectStart = flow.indexOf("const prefill = parseHotelReservationPrefill")
  const effectEnd = flow.indexOf("}, [searchParams, today]);", effectStart)
  assert.ok(effectStart >= 0 && effectEnd > effectStart)
  assert.doesNotMatch(flow.slice(effectStart, effectEnd), /apiClient|searchServicePoints|handleSubmit/)
})

test("hotel handoff parser never accepts booking authority from the URL", async () => {
  const parser = await readFile(prefillUrl, "utf8")

  assert.match(parser, /checkInDate/)
  assert.match(parser, /checkOutDate/)
  assert.match(parser, /guestCount/)
  assert.match(parser, /MAX_HOTEL_RESERVATION_GUEST_COUNT = 50/)
  assert.doesNotMatch(parser, /apiClient|servicePointId|pricePerNight|secureToken|reservationStatus/)
})
