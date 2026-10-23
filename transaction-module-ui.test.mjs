import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const transactionsPageUrl = new URL(
  "./app/owner/transactions/page.tsx",
  import.meta.url,
)

test("hybrid hotel transactions preserve capability-driven module tabs", async () => {
  const page = await readFile(transactionsPageUrl, "utf8")

  assert.match(page, /isHybridHotel/)
  assert.match(page, /enabledModules\.includes\("lodging"\)/)
  assert.match(page, /enabledModules\.includes\("foodService"\)/)
  assert.match(page, /label: "Overview"/)
  assert.match(page, /label: "Lodging"/)
  assert.match(page, /label: "Food Service"/)
  assert.match(page, /transaction\.sourceType === "reservation"/)
  assert.match(page, /transaction\.sourceType === "order"/)
  assert.doesNotMatch(page, /queryParams\.append\("module"/)
})

test("transactions refinement keeps financial truth compact and ledger-first", async () => {
  const page = await readFile(transactionsPageUrl, "utf8")

  assert.match(page, /Gross Revenue/)
  assert.match(page, /Before platform fees · excludes tips/)
  assert.match(page, /QuickServe Fees/)
  assert.match(page, /Net Revenue/)
  assert.match(page, /Collected separately · passed through to staff/)
  assert.match(page, /Transaction ledger/)
  assert.doesNotMatch(page, /Export/)
  assert.doesNotMatch(page, /\+12%|\+14%|\+18%|-5%/)
})

test("transactions use independent server-side filter dimensions", async () => {
  const page = await readFile(transactionsPageUrl, "utf8")

  assert.match(page, /queryParams\.set\("paymentStatus", statusFilter\)/)
  assert.match(page, /queryParams\.set\("paymentChannel", channelFilter\)/)
  assert.match(page, /queryParams\.set\("paidVia", methodFilter\)/)
  assert.match(page, /queryParams\.set\("servicePoint", servicePointFilter\)/)
  assert.match(page, /Filter by payment status/)
  assert.match(page, /Filter by payment channel/)
  assert.match(page, /Filter by payment method/)
  assert.match(page, /Filter by service point/)
  assert.doesNotMatch(page, /filterOptions\.map/)
})

test("ledger and details preserve canonical IDs while presenting short references", async () => {
  const page = await readFile(transactionsPageUrl, "utf8")

  assert.match(page, /shortTransactionReference/)
  assert.match(page, /navigator\.clipboard\.writeText\(canonicalId\)/)
  assert.match(page, /Transaction ID copied/)
  assert.match(page, /<Sheet open onOpenChange=/)
  assert.match(page, /tabIndex=\{0\}/)
  assert.match(page, /event\.key === "Enter" \|\| event\.key === " "/)
  assert.doesNotMatch(page, />Actions</)
})

test("transactions preserve receipt behavior and distinct result states", async () => {
  const page = await readFile(transactionsPageUrl, "utf8")

  assert.match(page, /`\/orders\/\$\{selectedTransaction\.orderId\}\/receipt`/)
  assert.match(page, /Resend Receipt/)
  assert.match(page, /No transactions in this period\./)
  assert.match(page, /No transactions match these filters\./)
  assert.match(page, /Transactions unavailable/)
  assert.match(page, /className="divide-y divide-border lg:hidden"/)
})
