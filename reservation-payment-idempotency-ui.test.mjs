import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("Reservation Pay posts only the secure token to the canonical endpoint", async () => {
  const source = await read("./app/reservation/pay/[secureToken]/page.tsx")
  assert.match(source, /post\("\/payments\/checkout-reservation", \{ secureToken \}\)/)
  assert.doesNotMatch(source, /attemptId:/)
})

test("Reservation Pay has a synchronous double-click guard", async () => {
  const source = await read("./app/reservation/pay/[secureToken]/page.tsx")
  const handler = source.slice(source.indexOf("const handlePay"), source.indexOf("if (isLoading)"))
  assert.ok(handler.indexOf("if (checkoutStartedRef.current) return") < handler.indexOf("apiClient.post"))
  assert.match(handler, /checkoutStartedRef\.current = true/)
})

test("Reservation Pay keeps the button disabled while Checkout resolves", async () => {
  const source = await read("./app/reservation/pay/[secureToken]/page.tsx")
  assert.match(source, /disabled=\{isCheckingOut \|\| !isPending \|\| !hasValidAmount\}/)
  assert.match(source, /Redirecting to payment/)
})

test("Reservation Pay permits retry after a definitive API failure", async () => {
  const source = await read("./app/reservation/pay/[secureToken]/page.tsx")
  const resets = source.match(/checkoutStartedRef\.current = false/g) || []
  assert.equal(resets.length, 2)
})

test("Reservation Pay navigates only from the canonical returned Session URL", async () => {
  const source = await read("./app/reservation/pay/[secureToken]/page.tsx")
  assert.match(source, /window\.location\.href = res\.data\.sessionUrl/)
  assert.equal((source.match(/window\.location\.href =/g) || []).length, 1)
})

test("Reservation Pay refresh reloads authoritative Reservation state", async () => {
  const source = await read("./app/reservation/pay/[secureToken]/page.tsx")
  assert.match(source, /get\(`\/public\/reservations\/by-token\/\$\{secureToken\}`/)
})

test("Reservation Pay preserves local and backend expiry handling", async () => {
  const source = await read("./app/reservation/pay/[secureToken]/page.tsx")
  assert.match(source, /paymentExpiresAt/)
  assert.match(source, /Payment Link Expired/)
})

test("confirmation page polls while webhook confirmation is pending", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /X-Reservation-Confirmation-Session/)
  assert.match(source, /r\.status === "accepted_awaiting_payment" && attempt < 5/)
  assert.match(source, /setTimeout\(\(\) => fetchData\(attempt \+ 1\), 2000\)/)
})

test("confirmation page gates success on authoritative paid state", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /reservation\?\.paymentStatus === "paid"/)
  assert.ok(source.indexOf("if (!isPaid)") < source.indexOf("Booking Confirmed!"))
})

test("confirmation page renders processing and failure states without false success", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /Confirming Payment/)
  assert.match(source, /Payment Not Confirmed/)
  assert.match(source, /confirmed only after payment is verified/)
})

test("confirmation polling timer is cleaned up on unmount", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /if \(retryTimer\) clearTimeout\(retryTimer\)/)
})

test("owner Transactions surfaces durable duplicate-payment reconciliation", async () => {
  const [page, types] = await Promise.all([
    read("./app/owner/transactions/page.tsx"),
    read("./types/transaction.ts"),
  ])
  assert.match(types, /paymentReconciliationStatus\?: "required" \| "resolved" \| null/)
  assert.match(types, /unexpectedPaymentAmountCents\?: number/)
  assert.match(page, /Payment reconciliation required/)
  assert.match(page, /Review the Stripe payments before taking financial action/)
})
