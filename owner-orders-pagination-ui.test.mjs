import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const ordersPageUrl = new URL("./app/owner/orders/page.tsx", import.meta.url)
const billingPageUrl = new URL("./app/owner/billing/page.tsx", import.meta.url)

test("owner Orders requests a fixed 25-record cursor page and renders Previous/Next controls", async () => {
  const page = await readFile(ordersPageUrl, "utf8")

  assert.match(page, /new URLSearchParams\(\{[\s\S]*?limit: "25"/)
  assert.match(page, /params\.set\("cursor", pageRequest\.cursor\)/)
  assert.match(page, /params\.set\("direction", pageRequest\.direction\)/)
  assert.match(page, /pagination\.previousCursor/)
  assert.match(page, /pagination\.nextCursor/)
  assert.match(page, /handlePageNavigation\("previous"\)/)
  assert.match(page, /handlePageNavigation\("next"\)/)
})

test("range, status, custom dates, and search all load the first cursor page", async () => {
  const page = await readFile(ordersPageUrl, "utf8")

  assert.match(page, /const FIRST_PAGE_REQUEST: PageRequest = \{ cursor: null, direction: "next" \}/)
  assert.match(page, /void fetchOrders\(FIRST_PAGE_REQUEST\)/)
  assert.match(page, /range,[\s\S]*?status: statusFilter,[\s\S]*?limit: "25"/)
  assert.match(page, /params\.set\("search", debouncedSearch\)/)
  assert.match(page, /setDebouncedSearch\(normalizeOrderSearch\(searchQuery\)\)/)
  assert.match(page, /params\.set\("from", customRange\.from\)/)
  assert.match(page, /params\.set\("to", customRange\.to\)/)
  assert.doesNotMatch(page, /params\.set\("businessId"/)
})

test("Orders SSE refreshes the current 25-record page and marks deeper pages as having new orders", async () => {
  const page = await readFile(ordersPageUrl, "utf8")

  assert.match(page, /fetchOrders\(currentPageRequestRef\.current, \{ silent: true, preserveRows: true \}\)/)
  assert.match(page, /if \(currentPageRequestRef\.current\.cursor\) setNewOrdersAvailable\(true\)/)
  assert.match(page, /order_created: \(\) => \{[\s\S]*?triggerDebouncedRefresh\(\)/)
  assert.match(page, /order_updated: triggerDebouncedRefresh/)
  assert.match(page, /New orders available/)
  assert.match(page, /Jump to latest/)
  assert.doesNotMatch(page, /limit", "1000"/)
})

test("failed page navigation preserves current rows and exposes cursor recovery", async () => {
  const page = await readFile(ordersPageUrl, "utf8")

  assert.match(page, /preserveRows \|\| silent/)
  assert.match(page, /toast\.error\("Failed to load that orders page\. Please try again\."\)/)
  assert.match(page, /result === "invalid-cursor"/)
  assert.match(page, /Returning to the latest orders/)
  assert.doesNotMatch(page, /setOrders\(\[\]\)/)
})

test("Billing uses its aggregate tip total and no longer requests the paginated Orders endpoint", async () => {
  const billingPage = await readFile(billingPageUrl, "utf8")

  assert.doesNotMatch(billingPage, /\/owner\/orders/)
  assert.match(billingPage, /revenueSummary\.totalTipsProcessed/)
  assert.match(billingPage, /const totalTipsCollected = revenueSummaryTipsCollected/)
})
