import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const readPage = () => readFile(new URL("./app/housekeeping/page.tsx", import.meta.url), "utf8")

test("status tabs expose all four operational views and default to Needs Cleaning", async () => {
  const source = await readPage()

  assert.match(source, /type QueueStatusView = HousekeepingReadiness \| "urgent"/)
  assert.match(source, /STATUS_TABS[\s\S]*needs_cleaning[\s\S]*Needs Cleaning[\s\S]*cleaning[\s\S]*In Progress[\s\S]*urgent[\s\S]*Urgent[\s\S]*ready[\s\S]*Ready/)
  assert.match(source, /useState<QueueStatusView>\("needs_cleaning"\)/)
  assert.match(source, /aria-label="Housekeeping status"/)
})

test("tab counts reuse canonical readiness counts and the existing canonical urgent projection", async () => {
  const source = await readPage()

  assert.match(source, /needs_cleaning: queue\?\.counts\.needs_cleaning \|\| 0/)
  assert.match(source, /cleaning: queue\?\.counts\.cleaning \|\| 0/)
  assert.match(source, /ready: queue\?\.counts\.ready \|\| 0/)
  assert.match(source, /urgentCount = allRooms\.filter\(\(room\) => room\.operation\?\.active && room\.operation\.priority === "urgent"\)\.length/)
  assert.match(source, /urgent: urgentCount/)
  assert.match(source, /\{tab\.label\} \(\{statusCounts\[tab\.value\]\}\)/)
})

test("readiness views and urgent priority view preserve canonical domain semantics", async () => {
  const source = await readPage()

  assert.match(source, /if \(statusView === "urgent"\) return room\.operation\?\.priority === "urgent"/)
  assert.match(source, /return room\.readiness === statusView/)
  assert.doesNotMatch(source, /readiness === "urgent"|readiness: "urgent"|status === "urgent"/)
})

test("status, assignment, search, advanced filters, and sort compose in one room pipeline", async () => {
  const source = await readPage()
  const pipeline = source.slice(source.indexOf("const visibleRooms = useMemo"), source.indexOf("const activeFilterCount"))

  assert.match(pipeline, /matchesStatusView\(room, statusView\)/)
  assert.match(pipeline, /effectiveScope === "my"[\s\S]*assignedTo === user\?\.staffId[\s\S]*claimedBy === user\?\.staffId/)
  assert.match(pipeline, /effectiveScope === "unassigned"[\s\S]*isUnassignedRoom\(room\)/)
  assert.match(pipeline, /normalizedQuery[\s\S]*room\.label[\s\S]*room\.roomType/)
  assert.match(pipeline, /filters\.priorities\.includes\(room\.operation\.priority\)/)
  assert.match(pipeline, /filters\.roomType !== "all"/)
  assert.match(pipeline, /sort === "priority"[\s\S]*sort === "room"/)
  assert.match(source, /aria-label="Housekeeping assignment scope"/)
  for (const label of ["My Rooms", "Unassigned", "All Rooms"]) assert.match(source, new RegExp(label))
})

test("KPI cards and filter dialog share the same status selection", async () => {
  const source = await readPage()

  for (const value of ["needs_cleaning", "cleaning", "ready", "urgent"]) {
    assert.match(source, new RegExp(`active=\\{statusView === "${value}"\\}[\\s\\S]*selectStatusView\\("${value}"\\)`))
  }
  assert.match(source, /type="radio" name="housekeeping-status" checked=\{statusView === option\.value\} onChange=\{\(\) => selectStatusView\(option\.value\)\}/)
  assert.match(source, /fieldset disabled=\{statusView === "urgent"\}/)
  assert.doesNotMatch(source, /filters\.statuses|STATUS_FILTERS/)
})

test("SSE and conflict recovery refetch without resetting selected UI state", async () => {
  const source = await readPage()
  const loadQueue = source.slice(source.indexOf("const loadQueue = useCallback"), source.indexOf("const loadEligibleStaff"))

  assert.match(source, /housekeeping_changed: \(\) => \{[\s\S]*void loadQueue\(\)/)
  assert.match(source, /result\.status === 409[\s\S]*await loadQueue\(\)/)
  assert.doesNotMatch(loadQueue, /setStatusView|setScope|setQuery|setFilters|setSort/)
})

test("mobile status navigation remains readable and existing actions remain wired", async () => {
  const source = await readPage()

  assert.match(source, /overflow-x-auto[\s\S]*\[&::-webkit-scrollbar\]:hidden[\s\S]*shrink-0 rounded-xl/)
  assert.match(source, /openPrimaryAction\(room\)/)
  assert.match(source, /openAssignment\(room\)/)
  assert.match(source, /runAction\(room, "start"\)/)
  assert.match(source, /setCompletionRoomId\(room\.servicePointId\)/)
  assert.match(source, /workflow="service_room"/)
})

test("empty states explain the selected status and assignment combination", async () => {
  const source = await readPage()

  for (const message of [
    "No rooms assigned to you need cleaning.",
    "No unassigned rooms need cleaning.",
    "You don't have any rooms in progress.",
    "No urgent rooms right now.",
    "No rooms are currently ready.",
  ]) {
    assert.match(source, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.match(source, /emptyRoomsMessage\(statusView, effectiveScope\)/)
})
