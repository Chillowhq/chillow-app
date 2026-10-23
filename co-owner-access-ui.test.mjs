import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("frontend canonical access resolver keeps Co-Owners default-allow and Managers default-deny", async () => {
  const source = await read("./lib/manager-permissions.ts")
  assert.doesNotMatch(source, /OWNER_BYPASS_ROLES[^\n]+co_owner/)
  assert.match(source, /user\.role === "co_owner"[\s\S]+!\(user\.coOwnerRestrictions \|\| \[\]\)\.includes\(area\)/)
  assert.match(source, /user\.role === "manager"[\s\S]+\(user\.permissions \|\| \[\]\)/)
  assert.match(source, /PAYMENTS_AND_BILLING: "payments_billing"/)
  assert.match(source, /INVENTORY: "inventory"/)
  assert.match(source, /INVENTORY_ADJUST: "inventory\.adjust"/)
  assert.match(source, /\[MANAGEMENT_ACCESS_AREAS\.PAYMENTS_AND_BILLING, "\/owner\/billing"\]/)
})

test("authorization failures preserve an authenticated management session", async () => {
  const source = await read("./hooks/use-auth-guard.ts")
  assert.match(source, /if \(!user\) \{\s*router\.replace\("\/login"\)/)
  assert.match(source, /const isManagementUser = \["owner", "co_owner", "manager"/)
  assert.match(source, /router\.replace\(isManagementUser \? getFirstPermittedManagementPath\(user\) : "\/login"\)/)
  assert.match(source, /Access denied\. You don't have permission to view this page\./)
  assert.doesNotMatch(source, /logout\(\)/)
})

test("sidebar and page guards use effective Co-Owner areas", async () => {
  const source = await read("./app/owner/layout.tsx")
  assert.match(source, /billing: \{[^\n]+requiredArea: MANAGEMENT_ACCESS_AREAS\.PAYMENTS_AND_BILLING/)
  assert.match(source, /branding: \{[^\n]+requiredArea: MANAGEMENT_ACCESS_AREAS\.BRANDING/)
  assert.match(source, /user\?\.role === "co_owner"\) return hasManagementArea\(user, item\.requiredArea\)/)
  assert.match(source, /requiredArea: pageAccess\.requiredArea/)
  assert.match(source, /Account workspaces are platform-level management surfaces/)
  assert.match(source, /navigationItemCatalog\.billing/)
  assert.match(source, /user\.role === "owner" && <SetupJourneyTracker/)
})

test("Billing is available by capability while ownership-sensitive controls stay Primary Owner only", async () => {
  const source = await read("./app/owner/billing/page.tsx")
  assert.match(source, /useAuthGuard\(\{ requiredArea: MANAGEMENT_ACCESS_AREAS\.PAYMENTS_AND_BILLING \}\)/)
  assert.match(source, /const isPrimaryOwner = user\?\.role === "owner"/)
  assert.match(source, /Only the Primary Owner can change plans, payment methods, fee configuration, or Stripe account ownership/)
  assert.match(source, /isPrimaryOwner && <section[\s\S]+Manage Plan/)
  assert.match(source, /Stripe onboarding and account-management links are available only to the Primary Owner/)
  assert.match(source, /apiClient\.get\("\/owner\/billing"\)/)
})

test("Team Access manages restrictions per Co-Owner through the primary-owner API", async () => {
  const source = await read("./app/owner/settings/team-access/page.tsx")
  assert.match(source, /useAuthGuard\(\{ requiredRole: "primary_owner" \}\)/)
  assert.match(source, /`\/owner\/team\/co-owner\/\$\{coOwner\.staffId\}\/access`/)
  assert.match(source, /coOwnerRestrictions: nextRestrictions/)
  assert.match(source, /CO_OWNER_ACCESS_GROUPS\.map/)
  assert.match(source, /\["Manage Co-Owners", "Transfer Ownership", "Delete Business"\]/)
  assert.match(source, /collapsedCoOwners/)
  assert.match(source, /Minimize access controls/)
})

test("Co-Owner access changes use targeted SSE invalidation without polling or focus refresh", async () => {
  const source = await read("./contexts/AuthContext.tsx")
  const eventSource = await read("./hooks/use-event-source.ts")
  assert.match(source, /user\?\.role === "co_owner" \? "\/auth\/access-events" : ""/)
  assert.match(source, /co_owner_access_changed: scheduleCoOwnerAccessRefresh/)
  assert.match(source, /accessRefreshInFlightRef\.current/)
  assert.match(source, /window\.setTimeout\([\s\S]+150\)/)
  assert.match(source, /onOpen: refreshCoOwnerAccess/)
  assert.match(source, /onReconnect: refreshCoOwnerAccess/)
  assert.match(source, /recoverOnVisibility: false/)
  assert.match(source, /apiClient\.get<DashboardUser>\("\/auth\/me"\)[\s\S]+setUser\(res\.data\)/)
  assert.match(source, /preserveOnTransientError: true/)
  assert.doesNotMatch(source, /setInterval/)
  assert.doesNotMatch(source, /addEventListener\("focus"/)
  assert.match(eventSource, /recoverOnVisibility !== false/)
})

test("Dashboard and denied-state links respect revoked Billing access", async () => {
  const dashboard = await read("./app/owner/dashboard/page.tsx")
  const denied = await read("./app/owner/access-denied/page.tsx")
  assert.match(dashboard, /!item\.href\.startsWith\("\/owner\/billing"\)[\s\S]+hasManagementArea\(user, MANAGEMENT_ACCESS_AREAS\.PAYMENTS_AND_BILLING\)/)
  assert.match(dashboard, /area: MANAGEMENT_ACCESS_AREAS\.PAYMENTS_AND_BILLING/)
  assert.match(denied, /Your account remains signed in/)
})

test("operational staff views admit Co-Owners only through the Orders area", async () => {
  const bar = await read("./app/bar/page.tsx")
  const waitstaff = await read("./app/waitstaff/layout.tsx")
  const login = await read("./app/login/page.tsx")
  assert.match(bar, /requiredRole: \["bartender", "owner", "co_owner", "manager"\]/)
  assert.match(bar, /requiredArea: MANAGEMENT_ACCESS_AREAS\.ORDERS/)
  assert.match(bar, /permission=\$\{MANAGER_PERMISSIONS\.ORDERS_VIEW\}/)
  assert.match(waitstaff, /requiredArea: MANAGEMENT_ACCESS_AREAS\.ORDERS/)
  assert.match(login, /user\.role === "co_owner" \|\| user\.role === "manager"/)
})
