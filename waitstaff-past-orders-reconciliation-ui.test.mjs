import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const page = fs.readFileSync(new URL("./app/waitstaff/past-orders/page.tsx", import.meta.url), "utf8")
const dialog = fs.readFileSync(new URL("./components/waitstaff/OrderReconciliationDialog.tsx", import.meta.url), "utf8")

test("past orders gives authorized reconciliation users one active reconciliation entry point", () => {
  assert.match(page, /OrderReconciliationDialog/)
  assert.match(page, /canReconcileOrders && unresolved/)
  assert.match(page, /label: "Review & Reconcile"/)
  assert.match(page, /label: "View Details"/)
  assert.doesNotMatch(page, /label: "Mark Completed"/)
  assert.doesNotMatch(page, /label: "Resolve Payment"/)
})

test("the reconciliation modal is compact and keeps history behind View details", () => {
  assert.match(dialog, />\s*Reconcile Order\s*</)
  assert.match(dialog, /Order: \{order\.orderId\}/)
  assert.match(dialog, /Payment\s*<\/p><p[^>]*>\{paymentSummary\(order\)\}/)
  assert.match(dialog, /Was this order served\?/)
  assert.match(dialog, /Was payment received\?/)
  assert.match(dialog, /Correction note <span[^>]*>\(optional\)<\/span>/)
  assert.match(dialog, /View details/)
  assert.doesNotMatch(dialog, /What Chillow recorded:/)
  assert.doesNotMatch(dialog, /Recorded history/)
  assert.doesNotMatch(dialog, /I checked reliable information and confirm this order was served/)
  assert.doesNotMatch(dialog, /correctionStep/)
})

test("the modal records only permitted offline payments and does not offer online confirmation", () => {
  assert.match(dialog, /paymentChannel === "offline"/)
  assert.match(dialog, /Yes, Cash/)
  assert.match(dialog, /Yes, POS Card/)
  assert.match(dialog, /Payment is still awaiting provider confirmation\. It cannot be confirmed here\./)
  assert.match(dialog, /paymentCanSupportCompletion/)
  assert.match(dialog, /You don&apos;t have permission to reconcile orders\. Ask your manager or business owner\./)
})

test("the completed result is based on persisted backend values and partial failures stay visible", () => {
  assert.match(page, /response\.data\?\.status \|\| "completed"/)
  assert.match(page, /response\.data\?\.completedAt/)
  assert.match(page, /response\.data\?\.reconciliation\?\.performedBy\?\.name/)
  assert.match(page, /Payment was recorded, but the order was not completed:/)
  assert.match(dialog, /Order reconciled/)
  assert.match(dialog, /Reconciled by \{result\.persisted\.reconciledBy\}/)
})

test("saved correction notes are confirmed immediately and shown in the order timeline", () => {
  assert.match(page, /correctionNote: response\.data\?\.historicalServiceCorrection\?\.reason \|\| reconciliation\?\.reason \|\| null/)
  assert.match(page, /Correction note: \{entry\.reason\}/)
  assert.match(dialog, /Correction note: \{result\.persisted\.correctionNote\}/)
})

test("past orders supports individual review only and has no batch reconciliation controls", () => {
  assert.doesNotMatch(page, /\/waitstaff\/reconciliation\/(selected|preview|all-eligible)/)
  assert.doesNotMatch(page, /Bulk Reconciliation/)
  assert.doesNotMatch(page, /Reconcile All Eligible/)
  assert.doesNotMatch(page, /Reconcile Selected/)
  assert.doesNotMatch(page, /Select all eligible orders/)
  assert.doesNotMatch(page, /businessId: user\?\.businessId/)
  assert.match(page, /You don't have permission to view past orders\. Ask your manager or business owner\./)
})

test("view-only access can inspect Past Orders but cannot change them", () => {
  const dashboard = fs.readFileSync(new URL("./app/waitstaff/page.tsx", import.meta.url), "utf8")
  assert.match(page, /orders\.reconciliation\.view/)
  assert.match(page, /const canViewPastOrders = canReconcileOrders/)
  assert.match(page, /View-only access/)
  assert.match(page, /canReconcileOrders && canSendReceipt\(order\)/)
  assert.match(page, /canReconcileOrders && unresolved/)
  assert.match(page, /!loading && !error && !accessDenied && orders\.length === 0/)
  assert.match(dashboard, /orders\.reconciliation\.view/)
  assert.match(dashboard, /\{canViewPastOrders && \(/)
})
