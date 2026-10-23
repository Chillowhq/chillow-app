import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageUrl = new URL(
  "./app/owner/service-points/page.tsx",
  import.meta.url,
)
const pageHeaderUrl = new URL("./components/shared/PageHeader.tsx", import.meta.url)

test("service point management presents the approved header and truthful KPI semantics", async () => {
  const [source, pageHeaderSource] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(pageHeaderUrl, "utf8"),
  ])

  assert.match(source, /<PageHeader[\s\S]*title="Service Points"/)
  assert.match(pageHeaderSource, /<h1/)
  assert.match(
    source,
    /Manage the places where guests interact with your business\./,
  )
  assert.match(source, /label="Total Service Points"/)
  assert.match(source, /label="Active"/)
  assert.match(source, /label="Reservations On"/)
  assert.match(source, /label="Live Guest Devices"/)
  assert.match(source, /servicePoint\.reservable !== false/)
  assert.doesNotMatch(source, /Active Customers Now/)
})

test("status, reservation, search, and canonical type filters remain independent", async () => {
  const source = await readFile(pageUrl, "utf8")

  for (const label of [
    "All Service Points",
    "Active",
    "Inactive",
    "Reservations On",
    "Reservations Off",
  ]) {
    assert.match(source, new RegExp(`label: "${label}"`))
  }
  assert.match(source, /servicePoint\.label\.toLowerCase\(\)\.includes/)
  assert.match(source, /servicePoint\.code\?\.toLowerCase\(\)\.includes/)
  assert.match(source, /servicePoint\.servicePointType === typeFilter/)
  assert.match(source, /TYPE_LABELS: Record<ServicePointType, string>/)
  assert.match(source, /aria-label="Filter service points by type"/)
})

test("desktop table and mobile cards expose core fields and managed actions", async () => {
  const source = await readFile(pageUrl, "utf8")

  for (const heading of [
    "Name",
    "Code",
    "Type",
    "Capacity",
    "Status",
    "Reservations",
    "Actions",
  ]) {
    assert.match(source, new RegExp(`>${heading}<|>\\s*${heading}\\s*<`))
  }
  assert.match(source, /className="hidden lg:block"/)
  assert.match(source, /className="divide-y divide-border lg:hidden"/)
  assert.match(source, />\s*View QR\s*<\/Button>/)
  assert.match(source, />\s*Edit\s*<\/Button>/)
  assert.match(source, /Turn reservations \{servicePoint\.reservable/)
  assert.match(source, /servicePoint\.isActive \? "Deactivate" : "Activate"/)
  assert.match(source, /Delete service point/)
  assert.match(source, /role="menu"/)
  assert.match(source, /role="menuitem"/)
  assert.match(source, /aria-haspopup="menu"/)
})

test("live activity reuses the existing device endpoint and has isolated loading and error states", async () => {
  const source = await readFile(pageUrl, "utf8")

  assert.match(source, /"\/owner\/table-sessions\/overview"/)
  assert.doesNotMatch(source, /table-sessions\/overview\?businessId=/)
  assert.match(source, /Active Service Points Now/)
  assert.match(source, /sessionOverview\?\.activeServicePointsNow/)
  assert.match(source, /sessionOverview\?\.activeGuestDevicesNow/)
  assert.match(source, /item\.activeDevices/)
  assert.match(source, /No active connections right now\./)
  assert.match(source, /Live activity could not be refreshed\./)
  assert.match(source, /aria-label="Refresh live activity"/)
  assert.doesNotMatch(source, />\s*Live Sessions\s*</)
})

test("loading, page error, first-use empty, and filtered empty states are explicit", async () => {
  const source = await readFile(pageUrl, "utf8")

  assert.match(source, /function ServicePointListSkeleton/)
  assert.match(source, /loading=\{isLoading\}/)
  assert.match(source, /loading=\{isLiveLoading && !sessionOverview\}/)
  assert.match(source, /Service points could not be loaded/)
  assert.match(source, />\s*Retry\s*<\/Button>/)
  assert.match(source, /"No service points yet"/)
  assert.match(source, /"No service points match these filters"/)
  assert.match(source, />\s*Clear filters\s*<\/Button>/)
})

test("existing CRUD, lifecycle, reservation, QR, and modal contracts are preserved", async () => {
  const source = await readFile(pageUrl, "utf8")

  assert.match(source, /apiClient\.get<ServicePoint\[]>\(\s*"\/owner\/service-points"/)
  assert.match(source, /apiClient\.post<ServicePoint>\("\/owner\/service-points", payload\)/)
  assert.match(source, /\/owner\/service-points\/\$\{editingServicePoint\.servicePointId\}/)
  assert.match(source, /\/toggle-reservable/)
  assert.match(source, /\/toggle`/)
  assert.match(source, /apiClient\.delete/)
  assert.match(source, /<QrCodeModal/)
  assert.match(source, /<RestaurantServicePointModal/)
  assert.match(source, /<HotelServicePointModal/)
  assert.match(source, /This action cannot\s*\n?\s*be undone\./)
})
