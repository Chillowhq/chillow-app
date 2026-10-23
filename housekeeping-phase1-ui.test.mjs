import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("Housekeeping is an official Staff role with narrow permissions and its own destination", async () => {
  const [staff, login, permissions] = await Promise.all([
    read("./app/owner/staff/page.tsx"),
    read("./app/login/page.tsx"),
    read("./lib/manager-permissions.ts"),
  ])

  assert.match(staff, /role: "housekeeping"/)
  assert.match(staff, /label: "Housekeeping"/)
  assert.match(staff, /visibleModules\.includes\("lodging"\)/)
  assert.match(staff, /hasLodging \|\| role !== "housekeeping"/)
  assert.match(login, /user\.role === "housekeeping"/)
  assert.match(login, /router\.push\("\/housekeeping"\)/)
  for (const permission of ["housekeeping.view", "housekeeping.perform", "inventory.roomUsage.record"]) {
    assert.match(permissions, new RegExp(permission.replace(".", "\\.")))
  }
  assert.match(permissions, /STAFF_PERMISSION_ROLES = new Set\(\["manager", "housekeeping"\]\)/)
  assert.match(permissions, /STAFF_PERMISSION_ROLES\.has\(user\.role\)[\s\S]*includes\(permission\)/)
})

test("dedicated mobile Housekeeping workspace is lodging- and permission-gated", async () => {
  const [source, layout] = await Promise.all([
    read("./app/housekeeping/page.tsx"),
    read("./app/housekeeping/layout.tsx"),
  ])

  assert.match(source, /allowedRoles: \["housekeeping", "owner", "co_owner", "manager", "admin"\]/)
  assert.match(source, /requiredPermission: MANAGER_PERMISSIONS\.HOUSEKEEPING_VIEW/)
  assert.match(source, /visibleModules\.includes\("lodging"\)/)
  assert.match(source, /min-h-dvh/)
  assert.match(source, /max-w-(?:3xl|5xl|7xl)/)
  assert.doesNotMatch(source, /<OwnerLayout|owner navigation/i)
  assert.match(layout, /<AuthProvider>\{children\}<\/AuthProvider>/)
})

test("Housekeeping queue exposes the three readiness tabs and operational actions", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  for (const label of ["Needs Cleaning", "Cleaning", "Ready", "Start Cleaning", "Service Room", "No supplies used", "Complete Cleaning"]) {
    assert.match(source, new RegExp(label))
  }
  assert.match(source, /\/housekeeping\/operations\/\$\{encodeURIComponent\(operationId\)\}\/\$\{action\}/)
  assert.match(source, /result\.status === 409[\s\S]*loadQueue\(\)/)
  assert.match(source, /claimedByName/)
  assert.match(source, /startedAt/)
  assert.match(source, /completedByName/)
  assert.match(source, /completedAt/)
})

test("Housekeeping reuses Room Usage with a locked room and deterministic operation linkage", async () => {
  const [page, dialog] = await Promise.all([
    read("./app/housekeeping/page.tsx"),
    read("./components/owner/inventory/RoomUsageDialog.tsx"),
  ])

  assert.match(page, /<RoomUsageDialog/)
  assert.match(page, /workflow="service_room"/)
  assert.match(page, /housekeepingOperationId=\{serviceRoom\.operation\.housekeepingOperationId\}/)
  assert.match(dialog, /disabled=\{saving \|\| loadingRooms \|\| \(isServiceRoomWorkflow && Boolean\(initialServicePointId\)\)\}/)
  assert.match(dialog, /template\?\.suggestions/)
  assert.match(dialog, /inventoryQuantityToCanonical/)
  assert.match(dialog, /Remove \$\{line\.item\.name\}/)
  assert.match(dialog, /addItem\(item\)/)
  assert.match(dialog, /housekeeping:\$\{housekeepingOperationId\}:supplies:v1/)
  assert.doesNotMatch(dialog, /"\/owner\/inventory\/items"/)
})

test("Housekeeping uses SSE invalidation with reconnect and visibility recovery but no polling", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  assert.match(source, /useEventSource/)
  assert.match(source, /housekeeping_changed:[\s\S]*void loadQueue\(\)/)
  assert.match(source, /onOpen: loadQueue, onReconnect: loadQueue, recoverOnVisibility: true/)
  assert.match(source, /aria-label="Refresh Housekeeping"/)
  assert.doesNotMatch(source, /setInterval|poll/i)
})

test("hotel room cards keep existing state badges and add room readiness", async () => {
  const source = await read("./components/service-points/HotelServicePointViews.tsx")

  assert.match(source, /function RoomReadinessChip/)
  assert.match(source, /Needs Cleaning/)
  assert.match(source, /Cleaning/)
  assert.match(source, /Ready/)
  assert.match(source, /Reservations On/)
  assert.match(source, /room\.isActive/)
})
