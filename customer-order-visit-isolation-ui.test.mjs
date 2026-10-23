import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [history, status, confirmation, eta, notifications, waiterRequest, waitstaffHook, realtimeProvider, orderAgain] =
  await Promise.all([
    readFile(new URL("./components/order-history.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/s/[servicePointId]/status/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/s/[servicePointId]/confirmation/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/order-eta-widget.tsx", import.meta.url), "utf8"),
    readFile(new URL("./hooks/use-customer-notifications.ts", import.meta.url), "utf8"),
    readFile(new URL("./app/s/[servicePointId]/waitstaff-request/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./hooks/use-waitstaff-request.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "./components/providers/customer-guest-realtime-provider.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("./components/order-again-button.tsx", import.meta.url), "utf8"),
  ])

test("Order History remains the device-and-business history surface", () => {
  assert.match(history, /apiClient\.get\("\/orders", \{ params: \{ sessionId, businessId \} \}\)/)
  assert.match(history, /scope=history/g)
  assert.doesNotMatch(history, /apiClient\.get\("\/orders\/current"/)
})

test("live ETA reads use the GuestSession-authoritative current endpoint", () => {
  assert.match(eta, /apiClient\.get\("\/orders\/current"/)
  assert.match(eta, /"x-table-session-token": currentToken/)
  assert.match(eta, /scope=current/)
})

test("direct detail explicitly separates historical read-only and current live modes", () => {
  assert.match(status, /isHistoricalView = searchParams\.get\("scope"\) === "history"/)
  assert.match(status, /scope: isHistoricalView \? "history" : "current"/)
  assert.match(status, /"x-table-session-token": tableSessionToken/)
  assert.match(status, /!isHistoricalView && activeBusinessId/)
  assert.match(status, /!isHistoricalView && !isCancelled/)
  assert.match(status, /!isHistoricalView && order\.status === "completed"/)
})

test("confirmation opens only current-visit order details", () => {
  assert.match(confirmation, /scope: "current"/)
  assert.match(confirmation, /"x-table-session-token": tableSessionToken/)
  assert.match(confirmation, /scope=current/)
})

test("every customer SSE consumer sends the current device binding", () => {
  for (const source of [history, status, eta, notifications, waitstaffHook]) {
    assert.match(source, /events\?role=table[^`]*sessionId=/)
  }
  assert.match(waiterRequest, /useCustomerGuestRealtime\(\)\.waitstaff/)
  assert.match(realtimeProvider, /useWaitstaffRequest\(\{/)
})

test("Order Again proves a current visit while preserving historical source access", () => {
  assert.match(orderAgain, /getTableToken\(servicePointId\)/)
  assert.match(orderAgain, /servicePointId,/)
  assert.match(orderAgain, /tableSessionToken: tableSessionToken \|\| undefined/)
})
