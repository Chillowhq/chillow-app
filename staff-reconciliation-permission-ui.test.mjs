import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const page = fs.readFileSync(new URL("./app/owner/staff/page.tsx", import.meta.url), "utf8")

test("Staff Management uses the dedicated past-order access control", () => {
  assert.match(page, /const RECONCILIATION_PERMISSION = "orders\.reconcile"/)
  assert.match(page, /const RECONCILIATION_VIEW_PERMISSION = "orders\.reconciliation\.view"/)
  assert.match(page, /\/owner\/staff\/\$\{editingManager\.staffId\}\/reconciliation-permission/)
  assert.match(page, /\/owner\/staff\/\$\{editingWaiter\.staffId\}\/reconciliation-permission/)
  assert.match(page, /\/owner\/staff\/\$\{editingManager\.staffId\}\/reconciliation-view-permission/)
  assert.match(page, /\/owner\/staff\/\$\{editingWaiter\.staffId\}\/reconciliation-view-permission/)
  assert.match(page, /\{ allowed: editingWaiterReconciliationAllowed \}/)
  assert.match(page, /Past Order Access/)
  assert.match(page, /Can view, search, and inspect past orders, but cannot make changes\./)
})

test("only owners or staff-management-enabled co-owners can grant or revoke past-order access", () => {
  assert.match(page, /const canAdministerReconciliation = canManageStaff\s*&& \["owner", "co_owner", "restaurant_owner"\]\.includes\(user\?\.role \|\| ""\)/)
  assert.match(page, /canAdministerReconciliation && role === "waiter"/)
  assert.match(page, /canEditReconciliation=\{canAdministerReconciliation\}/)
  assert.doesNotMatch(page, /MANAGER_PERMISSIONS\.ORDERS_RECONCILE/)
})

test("the access checkbox is integrated into Manager and Waitstaff permission editing", () => {
  assert.match(page, /group\.label === "Orders" && canEditReconciliation/)
  assert.match(page, /View Reconciliation/)
  assert.match(page, /Reconcile Past Orders/)
  assert.match(page, /Included with Reconcile Past Orders\./)
  assert.match(page, /Edit Waitstaff Permissions/)
  assert.match(page, /WaitstaffPermissionsEditor/)
  assert.match(page, /editingManagerReconciliationAllowed/)
  assert.match(page, /editingManagerReconciliationViewAllowed/)
  assert.match(page, /editingWaiterReconciliationAllowed/)
  assert.match(page, /editingWaiterReconciliationViewAllowed/)
})
