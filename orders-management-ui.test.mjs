import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const page = await readFile(new URL("./app/owner/orders/page.tsx", import.meta.url), "utf8")
const details = await readFile(new URL("./components/orders/OwnerOrderDetailsSheet.tsx", import.meta.url), "utf8")
const reference = await readFile(new URL("./lib/order-reference.ts", import.meta.url), "utf8")

test("orders page implements the approved header, dates, and compact period KPIs", () => {
  assert.match(page, /Track and review orders across your business\./)
  for (const label of ["Today", "Yesterday", "Last 7 days", "This month", "Custom"]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.match(page, /label="Total Orders"/)
  assert.match(page, /label="Active Orders"/)
  assert.match(page, /counts\.placed \+ counts\.in_progress \+ counts\.ready/)
  assert.match(page, /label="Completed Orders"/)
  assert.match(page, /label="Total Order Value"/)
  assert.doesNotMatch(page, /label="Total Revenue"/)
})

test("order references are presentation-only and full IDs remain the API/search authority", () => {
  assert.match(reference, /compact\.slice\(-4\)/)
  assert.match(reference, /replace\(\/\^#\+\//)
  assert.match(page, /formatOrderReference\(order\.orderId\)/)
  assert.match(page, /params\.set\("search", debouncedSearch\)/)
  assert.doesNotMatch(page, /businessId.*params/)
  assert.match(details, /order\.orderId/)
  assert.match(details, /navigator\.clipboard\.writeText\(order\.orderId\)/)
})

test("filters use the existing server query and keep lifecycle and payment separate", () => {
  assert.match(page, /params\.set\("orderType", orderTypeFilter\)/)
  assert.match(page, /params\.set\("paymentStatus", paymentFilter\)/)
  assert.match(page, /params\.set\("servicePointId", servicePointFilter\)/)
  assert.match(page, /Filter orders by lifecycle status/)
  assert.match(page, /OwnerOrderPaymentBadge/)
  assert.match(page, /OwnerOrderStatusBadge/)
  assert.doesNotMatch(page, /Mark In Progress|Mark Ready|Mark Completed|Close Order/)
})

test("orders remain cursor paginated and do not render all records at once", () => {
  assert.match(page, /limit: "25"/)
  assert.match(page, /nextCursor/)
  assert.match(page, /previousCursor/)
  assert.match(page, /Showing.*of.*order/)
  assert.match(page, /Most recent/)
})

test("desktop rows, mobile cards, and accessible details use the established primitives", () => {
  assert.match(page, /hidden lg:block/)
  assert.match(page, /lg:hidden/)
  assert.match(page, /role="button"/)
  assert.match(page, /event\.key === "Enter" \|\| event\.key === " "/)
  assert.match(details, /<Sheet open=/)
  assert.match(details, /<SheetClose asChild>/)
  assert.match(details, />\s*Close\s*</)
  assert.match(details, /Copy full order ID/)
})

test("loading, empty, filtered-empty, and retry states are explicit", () => {
  assert.match(page, /<OrdersLoadingState/)
  assert.match(page, /No orders in this period\./)
  assert.match(page, /No orders match these filters\./)
  assert.match(page, />\s*Clear filters\s*</)
  assert.match(page, />\s*Retry\s*</)
})
