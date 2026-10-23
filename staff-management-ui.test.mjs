import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageUrl = new URL("./app/owner/staff/page.tsx", import.meta.url)

test("Staff Management preserves the existing staff and permission API flows", async () => {
  const page = await readFile(pageUrl, "utf8")

  assert.match(page, /apiClient\.get\("\/owner\/staff"/)
  assert.match(page, /apiClient\.post\("\/owner\/staff"/)
  assert.match(page, /apiClient\.patch\(`\/owner\/staff\/\$\{editingManager\.staffId\}\/permissions`/)
  assert.match(page, /apiClient\.delete\(`\/owner\/staff\/\$\{pendingRemoval\.staffId\}`/)
  assert.match(page, /MANAGER_PERMISSION_GROUPS\.map/)
  assert.match(page, /Remove Staff Member\?/)
  assert.match(page, /They will lose access to the system immediately/)
})

test("the staff directory prioritizes identity and keeps activity separate from account state", async () => {
  const page = await readFile(pageUrl, "utf8")

  assert.match(page, />Staff member<\/TableHead>/)
  assert.match(page, />Status \/ Activity<\/TableHead>/)
  assert.match(page, />Account<\/TableHead>/)
  assert.match(page, />Joined<\/TableHead>/)
  assert.doesNotMatch(page, />Staff ID<\/TableHead>/)
  assert.match(page, /member\.presenceStatus === "active"/)
  assert.match(page, /ACCOUNT_LABELS\[status\]/)
})

test("search, role, activity, and sorting operate on the loaded staff dataset", async () => {
  const page = await readFile(pageUrl, "utf8")

  assert.match(page, /Search staff by name or email\.\.\./)
  assert.match(page, /member\.name\.toLocaleLowerCase\(\)\.includes\(query\)/)
  assert.match(page, /member\.email\.toLocaleLowerCase\(\)\.includes\(query\)/)
  assert.match(page, /roleFilter === "all" \|\| getMemberRole\(member\) === roleFilter/)
  assert.match(page, /activityFilter === "all" \|\| member\.presenceStatus === activityFilter/)
  assert.match(page, /Name: A–Z/)
  assert.match(page, /Clear filters/)
})

test("Staff Details owns the secondary ID and supported management actions", async () => {
  const page = await readFile(pageUrl, "utf8")

  assert.match(page, /<Sheet open=\{open\}/)
  assert.match(page, /Staff Details/)
  assert.match(page, /Review this staff member&apos;s access and account information/)
  assert.match(page, /Copy Staff ID/)
  assert.match(page, /Edit Permissions/)
  assert.match(page, /Remove Staff/)
  assert.doesNotMatch(page, /Edit Staff Details/)
  assert.doesNotMatch(page, /Adeola Oni|Nelson Mboma|MGR-6052/)
})

test("the permissions modal scrolls its body while keeping its actions available", async () => {
  const page = await readFile(pageUrl, "utf8")

  assert.match(page, /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/)
  assert.match(page, /min-h-0 overflow-y-auto overscroll-contain/)
  assert.match(page, /Save Permissions/)
})

test("desktop and mobile render intentional staff directory layouts with accessible drill-in", async () => {
  const page = await readFile(pageUrl, "utf8")

  assert.match(page, /className="hidden lg:block"/)
  assert.match(page, /className="divide-y divide-border lg:hidden"/)
  assert.match(page, /aria-label=\{`View details for \$\{member\.name\}`\}/)
  assert.match(page, /focus-visible:ring-2/)
  assert.match(page, /aria-live="polite"/)
  assert.match(page, /aria-label=\{`Actions for \$\{member\.name\}`\}/)
})

test("loading, initial empty, filtered empty, and retryable error states are distinct", async () => {
  const page = await readFile(pageUrl, "utf8")

  assert.match(page, /<StaffLoadingState \/>/)
  assert.match(page, /Staff couldn&apos;t be loaded/)
  assert.match(page, /No staff members yet\./)
  assert.match(page, /No staff members match these filters\./)
  assert.match(page, /Retry\s*<\/Button>/)
})
