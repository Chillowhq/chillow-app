import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("login sends each established role to its existing canonical workspace", async () => {
  const source = await read("./app/login/page.tsx")
  const destinations = [
    ["owner", "/owner/dashboard"],
    ["kitchen", "/kitchen"],
    ["waiter", "/waitstaff"],
    ["bartender", "/bar"],
    ["housekeeping", "/housekeeping"],
  ]

  for (const [role, destination] of destinations) {
    assert.match(source, new RegExp(`user\\.role === "${role}"[\\s\\S]*?router\\.push\\("${destination}"\\)`))
  }
  assert.match(source, /user\.role === "co_owner" \|\| user\.role === "manager"/)
  assert.match(source, /getFirstPermittedManagementPath\(user\)/)
})

test("Housekeeping route guard accepts the role only with housekeeping.view", async () => {
  const [page, guard, permissions] = await Promise.all([
    read("./app/housekeeping/page.tsx"),
    read("./hooks/use-auth-guard.ts"),
    read("./lib/manager-permissions.ts"),
  ])

  assert.match(page, /allowedRoles: \["housekeeping", "owner", "co_owner", "manager", "admin"\]/)
  assert.match(page, /requiredPermission: MANAGER_PERMISSIONS\.HOUSEKEEPING_VIEW/)
  assert.match(guard, /requiredPermission && !hasManagementPermission\(user, requiredPermission\)/)
  assert.match(permissions, /STAFF_PERMISSION_ROLES = new Set\(\["manager", "housekeeping"\]\)/)
  assert.match(permissions, /STAFF_PERMISSION_ROLES\.has\(user\.role\) && \(user\.permissions \|\| \[\]\)\.includes\(permission\)/)
})

test("Housekeeping cannot inherit broad Owner access from the frontend fix", async () => {
  const [permissions, guard] = await Promise.all([
    read("./lib/manager-permissions.ts"),
    read("./hooks/use-auth-guard.ts"),
  ])

  assert.match(permissions, /PRIMARY_OWNER_BYPASS_ROLES = new Set\(\["owner", "restaurant_owner", "admin"\]\)/)
  assert.doesNotMatch(permissions, /PRIMARY_OWNER_BYPASS_ROLES = new Set\([^\n]*housekeeping/)
  assert.match(guard, /const isManagementUser = \["owner", "co_owner", "manager", "restaurant_owner", "admin"\]\.includes\(user\.role\)/)
})

test("workspace waits for canonical auth context before loading the tenant queue", async () => {
  const [context, page] = await Promise.all([
    read("./contexts/AuthContext.tsx"),
    read("./app/housekeeping/page.tsx"),
  ])

  assert.match(context, /apiClient\.get<DashboardUser>\("\/auth\/me"\)/)
  assert.match(page, /if \(!user \|\| !lodgingEnabled\) return/)
  assert.match(page, /apiClient\.get<HousekeepingQueueResponse>\("\/housekeeping\/rooms"\)/)
  assert.match(page, /if \(authLoading \|\| \(user && lodgingEnabled && loading && !queue\)\)/)
  assert.match(page, /if \(!user\) return null/)
})
