import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const restaurantPageUrl = new URL(
  "./app/reserve/[countryCode]/[businessSlug]/page.tsx",
  import.meta.url,
)
const hotelFlowUrl = new URL(
  "./components/reservations/hotel/HotelReservationFlow.tsx",
  import.meta.url,
)

test("public restaurant flow propagates route country to lookup, availability, and creation", async () => {
  const page = await readFile(restaurantPageUrl, "utf8")

  assert.match(page, /\/public\/business\/\$\{countryCode\}\/\$\{businessSlug\}/)
  assert.match(
    page,
    /\/public\/reservations\/restaurant-availability[\s\S]*params:\s*\{[\s\S]*businessSlug,[\s\S]*countryCode,/,
  )
  assert.match(
    page,
    /apiClient\.post\("\/public\/reservations",\s*\{[\s\S]*businessSlug,[\s\S]*countryCode,/,
  )
  assert.match(page, /JSON\.stringify\(\{ countryCode, businessSlug, \.\.\.formData \}\)/)
})

test("public hotel flow propagates route country to availability and creation", async () => {
  const flow = await readFile(hotelFlowUrl, "utf8")

  assert.match(
    flow,
    /\/public\/reservations\/available-rooms[\s\S]*params:\s*\{ countryCode, businessSlug, checkInDate, checkOutDate, guestCount \}/,
  )
  assert.match(
    flow,
    /apiClient\.post\("\/public\/reservations",\s*\{[\s\S]*countryCode,[\s\S]*businessSlug,/,
  )
})

test("public reservation UI does not introduce client businessId authority", async () => {
  const [page, flow] = await Promise.all([
    readFile(restaurantPageUrl, "utf8"),
    readFile(hotelFlowUrl, "utf8"),
  ])

  assert.doesNotMatch(page, /businessId:\s*business\?\./)
  assert.doesNotMatch(flow, /businessId:\s*business\?\./)
  assert.doesNotMatch(flow, /businessId:\s*business\./)
})
