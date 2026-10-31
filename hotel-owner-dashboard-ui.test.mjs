import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pagePath = new URL("./app/owner/dashboard/page.tsx", import.meta.url)
const hotelDashboardPath = new URL("./components/owner/dashboard/HotelDashboard.tsx", import.meta.url)

async function source(path) {
  return readFile(path, "utf8")
}

test("owner dashboard selects a server-authorized view without a client business id", async () => {
  const page = await source(pagePath)

  assert.match(page, /apiClient\.get<DashboardPayload>\("\/owner\/dashboard", \{\s*params: isHybridDashboard \? \{ dashboard: selectedDashboard \} : undefined,/)
  assert.doesNotMatch(page, /owner\/dashboard\?businessId=/)
  assert.match(page, /data\?\.dashboardType === "hotel"/)
  assert.match(page, /<HotelDashboard/)
  assert.match(page, /fetchGenerationRef/)
  assert.match(page, /setPageError\(/)
})

test("hotel dashboard keeps hotel operations primary and food service separate", async () => {
  const component = await source(hotelDashboardPath)

  for (const label of [
    "Hotel Dashboard",
    "Arrivals today",
    "Departures today",
    "Rooms currently occupied",
    "Rooms needing cleaning",
    "Needs attention",
    "Hotel bookings",
    "Housekeeping",
    "Room setup",
    "Payments",
    "Verified reservation payments collected during the hotel&apos;s local calendar day.",
    "This is separate from hotel booking revenue.",
  ]) {
    assert.match(component, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  assert.match(component, /!dashboardTabs && foodService \? <section/)
  assert.doesNotMatch(component, /Today&apos;s food revenue/)
  assert.doesNotMatch(component, /Open food orders/)
})

test("hybrid dashboards use capability-derived URL state and reuse each existing dashboard", async () => {
  const page = await source(pagePath)

  assert.match(page, /capabilities\?\.visibleModules/)
  assert.match(page, /visibleModules\.includes\("lodging"\) && visibleModules\.includes\("foodService"\)/)
  assert.match(page, /searchParams\.get\("dashboard"\)/)
  assert.match(page, /params\.set\("dashboard", selectedDashboard\)/)
  assert.match(page, /router\.push\(`\$\{pathname\}\?\$\{params\.toString\(\)\}`\)/)
  assert.match(page, /Accommodation/)
  assert.match(page, /Food Service/)
  assert.match(page, /title="Dashboard"/)
  assert.match(page, /dashboardTabs=\{hybridDashboardHeader\}/)
  assert.match(page, /hideHeader=\{isHybridDashboard\}/)
  assert.match(page, /\{hybridDashboardHeader\}/)
})

test("hotel dashboard handles restricted sections and uses established owner routes", async () => {
  const component = await source(hotelDashboardPath)

  assert.match(component, /Not available for your role\./)
  for (const route of [
    "/owner/reservations",
    "/housekeeping",
    "/owner/service-points?view=rooms",
    "/owner/transactions",
  ]) {
    assert.ok(component.includes(route), `missing dashboard route: ${route}`)
  }
})

test("hotel-relevant realtime events refresh the shared owner dashboard", async () => {
  const page = await source(pagePath)

  for (const event of [
    "reservation_created",
    "reservation_updated",
    "reservation_checked_in",
    "housekeeping_changed",
    "service_points_changed",
  ]) {
    assert.match(page, new RegExp(event))
  }
})
