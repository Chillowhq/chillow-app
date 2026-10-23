import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("workspace uses the approved four-card summary and canonical current-cleaning data", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  for (const label of ["Needs Cleaning", "In Progress", "Ready", "Urgent", "Currently Cleaning"]) {
    assert.match(source, new RegExp(label))
  }
  assert.match(source, /queue\?\.counts\.needs_cleaning/)
  assert.match(source, /queue\?\.counts\.cleaning/)
  assert.match(source, /queue\?\.counts\.ready/)
  assert.match(source, /operation\.priority === "urgent"/)
  assert.match(source, /room\.readiness === "cleaning"[\s\S]*claimedBy === user\?\.staffId/)
})

test("desktop, tablet and mobile have intentional queue presentations", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  assert.match(source, /data-layout="desktop-table"/)
  assert.match(source, /className="hidden lg:block"/)
  assert.match(source, /data-layout="tablet-list"/)
  assert.match(source, /className="hidden divide-y sm:block lg:hidden"/)
  assert.match(source, /data-layout="mobile-cards"/)
  assert.match(source, /className="divide-y sm:hidden"/)
  assert.doesNotMatch(source, /overflow-x-auto[^\n]*data-layout="mobile/)
})

test("scope, search, filters and optional sorting use loaded canonical room fields", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  for (const label of ["My Rooms", "Unassigned", "All Rooms", "Search rooms or room type", "Filters", "Sort: Priority", "Waiting longest", "All room types"]) {
    assert.match(source, new RegExp(label))
  }
  assert.match(source, /room\.label}[\s\S]*room\.roomType/)
  assert.match(source, /if \(sort === "priority"\) return filtered/)
  assert.doesNotMatch(source, />Floor</)
})

test("management exposes assignment while housekeepers retain the explicit self-claim and start command", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  assert.match(source, /canAssign && room\.operation\?\.status === "needs_cleaning"/)
  assert.match(source, /if \(isAssignmentAction\(room\)\) \{[\s\S]*openAssignment\(room\)/)
  assert.match(source, /return room\.operation\?\.assignedTo \? "Reassign" : "Assign"/)
  assert.match(source, /onClick=\{\(\) => openAssignment\(detailsRoom\)\}/)
  assert.match(source, /Claiming this room assigns it to you and starts cleaning immediately/)
  assert.match(source, /Claim & Start Cleaning/)
  assert.match(source, /runAction\(claimRoom, "start"\)/)
  assert.doesNotMatch(source, /\/claim["`]/)
})

test("finish flow is gated by canonical allowed actions and preserves Room Usage", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  assert.match(source, /completionRoom\?\.allowedActions\.serviceRoom/)
  assert.match(source, /completionRoom\?\.allowedActions\.noSuppliesUsed/)
  assert.match(source, /completionRoom\?\.allowedActions\.complete/)
  assert.match(source, /Record Supplies/)
  assert.match(source, /No Supplies Used/)
  assert.match(source, /Mark Room Ready/)
  assert.match(source, /response\?\.data\?\.error \|\| response\?\.data\?\.message \|\| fallback/)
  assert.match(source, /workflow="service_room"/)
  assert.doesNotMatch(source, /Room cleaned|Ready for inspection/)
})

test("details sheet and management actions expose only canonical state", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  assert.match(source, /<Sheet open=/)
  assert.match(source, /assignmentHistory\.map/)
  assert.match(source, /operation\?\.note\?\.trim/)
  assert.match(source, /canAssign && detailsRoom\.operation\.status === "needs_cleaning"/)
  assert.match(source, /canManage \? <Select/)
  assert.match(source, /canManage \? <div/)
})

test("redesign preserves conflict recovery and SSE invalidation without polling", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  assert.match(source, /result\.status === 409[\s\S]*loadQueue\(\)/)
  assert.match(source, /housekeeping_changed:[\s\S]*void loadQueue\(\)/)
  assert.match(source, /onOpen: loadQueue, onReconnect: loadQueue, recoverOnVisibility: true/)
  assert.doesNotMatch(source, /setInterval|WebSocket|poll/i)
})

test("unsupported visual-only mockup capabilities are not fabricated", async () => {
  const source = await read("./app/housekeeping/page.tsx")

  for (const unsupported of ["Guest arriving", "VIP arrival", "Late checkout", "Messages", "Golden Tulip", "property selector"]) {
    assert.doesNotMatch(source, new RegExp(unsupported, "i"))
  }
  assert.doesNotMatch(source, /<img|next\/image/)
})
