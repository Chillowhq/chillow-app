import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("Phase 2 exposes narrow assignment and management permissions", async () => {
  const permissions = await read("./lib/manager-permissions.ts")
  for (const permission of ["housekeeping.assign", "housekeeping.manage"]) {
    assert.match(permissions, new RegExp(permission.replace(".", "\\.")))
  }
  assert.match(permissions, /HOUSEKEEPING_ASSIGN[^\n]*HOUSEKEEPING_VIEW/)
  assert.match(permissions, /HOUSEKEEPING_MANAGE[^\n]*HOUSEKEEPING_VIEW/)
})

test("housekeepers see My Rooms first while the unassigned queue remains available", async () => {
  const source = await read("./app/housekeeping/page.tsx")
  assert.match(source, /My Rooms/)
  assert.match(source, /Unassigned/)
  assert.match(source, /Other Assigned Rooms/)
  assert.match(source, /operation\?\.assignedTo === user\.staffId/)
  assert.match(source, /!room\.operation\.assignedTo/)
})

test("manager operations use canonical selects and expected-state commands", async () => {
  const source = await read("./app/housekeeping/page.tsx")
  assert.match(source, /@\/components\/ui\/select/)
  assert.match(source, /\/housekeeping\/eligible-staff/)
  assert.match(source, /expectedAssignedTo: operation\.assignedTo/)
  assert.match(source, /expectedPriority: operation\.priority/)
  assert.match(source, /"Idempotency-Key"/)
  assert.match(source, /result\.status === 409[\s\S]*loadQueue\(\)/)
})

test("priority, duration, overdue, overview and history are visible without employee ranking", async () => {
  const source = await read("./app/housekeeping/page.tsx")
  for (const label of ["Normal", "Priority", "Urgent", "Overdue waiting", "Overdue cleaning", "Operations", "History", "Load more history"]) {
    assert.match(source, new RegExp(label))
  }
  assert.match(source, /timeZone: timezone/)
  assert.match(source, /servicePointId: historyRoom/)
  assert.match(source, /staffId: historyStaff/)
  assert.doesNotMatch(source, /best housekeeper|worst housekeeper|employee rank/i)
})

test("SLA targets are optional and no polling or browser-local authority is introduced", async () => {
  const source = await read("./app/housekeeping/page.tsx")
  assert.match(source, /No target is assumed when a field is blank/)
  assert.match(source, /targetStartMinutes/)
  assert.match(source, /targetCleaningMinutes/)
  assert.match(source, /housekeeping_changed/)
  assert.match(source, /onOpen: loadQueue, onReconnect: loadQueue, recoverOnVisibility: true/)
  assert.doesNotMatch(source, /setInterval|poll/i)
})

test("Inventory exceptions remain management-only and point to canonical Inventory correction", async () => {
  const source = await read("./app/housekeeping/page.tsx")
  assert.match(source, /canManage \? <div/)
  assert.match(source, /Acknowledge exception/)
  assert.match(source, /Open Inventory/)
  assert.match(source, /Mark reconciled/)
  assert.match(source, /This action does not change stock/)
  assert.match(source, /movementIds/)
})

test("Phase 1 Service Room and completion flow remain intact", async () => {
  const source = await read("./app/housekeeping/page.tsx")
  assert.match(source, /<RoomUsageDialog/)
  assert.match(source, /workflow="service_room"/)
  assert.match(source, /Start Cleaning/)
  assert.match(source, /No supplies used/)
  assert.match(source, /Complete Cleaning/)
})
