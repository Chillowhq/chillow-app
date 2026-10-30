import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("Owner Billing loads the tenant-scoped offline commission read endpoint as an independent resource", async () => {
  const page = await read("./app/owner/billing/page.tsx")

  assert.match(page, /offlineCommissions/)
  assert.match(page, /apiClient\.get\("\/owner\/billing\/offline-commissions", \{[\s\S]*?params: \{ page \}/)
  assert.match(page, /onActivityPageChange=\{fetchOfflineCommissionPage\}/)
  assert.match(page, /Offline commission details could not be loaded/)
  assert.match(page, /setResourceLoading\(\(current\) => \(\{ \.\.\.current, offlineCommissions: true \}\)\)/)
  assert.match(page, /const response = await apiClient\.get\("\/owner\/billing\/offline-commissions"[\s\S]*?setOfflineCommissions\(response\.data\)/)
  assert.match(page, /!offlineCommissions && resourceErrors\.offlineCommissions/)
})

test("Offline commission UI renders backend financial snapshots without calculating commission", async () => {
  const component = await read("./components/owner/billing/OfflineCommissionsSection.tsx")

  assert.match(component, /eligibleAmountCents/)
  assert.match(component, /commissionRateApplied/)
  assert.match(component, /commissionAmountCents/)
  assert.match(component, /formatMinorCurrency/)
  assert.match(component, /currentPeriodAccruedAmountCents/)
  assert.match(component, /accruedAmountCents/)
  assert.match(component, /invoicedAmountCents/)
  assert.match(component, /paidAmountCents/)
  assert.doesNotMatch(component, /commissionAmountCents\s*=/)
  assert.doesNotMatch(component, /eligibleAmountCents\s*[*/]/)
  assert.doesNotMatch(component, /commissionRateApplied\s*[*/]/)
  assert.doesNotMatch(component, /accrued[^\n]*charged/i)
})

test("Offline commission states keep held batches distinct from confirmed payment failures", async () => {
  const component = await read("./components/owner/billing/OfflineCommissionsSection.tsx")

  assert.match(component, /Held for reconciliation/)
  assert.match(component, /Confirmed payment failure/)
  assert.match(component, /Commission collection is disabled/)
  assert.match(component, /hidden overflow-x-auto md:block/)
  assert.match(component, /space-y-3 p-4 md:hidden/)
  assert.match(component, /Showing transactions \{activityStart\}/)
  assert.match(component, /Previous commission activity page/)
  assert.match(component, /Next commission activity page/)
  assert.match(component, /Previously displayed activity remains visible/)
  assert.doesNotMatch(component, /hostedInvoiceUrl|invoicePdf|hosted_invoice_url|invoice_pdf/)
})
