import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8")
}

test("owner menu exposes explicit fulfilment and conditional drink handling", () => {
  const source = read("./app/owner/menu/page.tsx")
  assert.match(source, /Fulfilment \*/)
  assert.match(source, /Food — Kitchen/)
  assert.match(source, /Drink — Bar/)
  assert.match(source, /Drink handling \*/)
  assert.match(source, /Ready to serve/)
  assert.match(source, /Requires preparation/)
  assert.match(source, /formData\.fulfillmentBehavior !== "direct"/)
  assert.match(source, /fulfillmentStation:/)
  assert.match(source, /fulfillmentBehavior:/)
})

test("Kitchen UI sends only canonical station actions and never completes orders", () => {
  const page = read("./app/kitchen/page.tsx")
  const card = read("./components/kitchen-order-card.tsx")
  assert.match(page, /\/kitchen\/orders\/\$\{orderId\}\/fulfillment/)
  assert.match(page, /action: "start" \| "ready"/)
  assert.match(page, /response\.data\.order/)
  assert.doesNotMatch(page, /\/kitchen\/orders\/\$\{orderId\}\/status/)
  assert.match(card, /START ORDER/)
  assert.match(card, /MARK READY/)
  assert.doesNotMatch(card, /handleFulfillmentAction\("completed"\)/)
})

test("Bar UI is active and handles direct and prepared lines independently", () => {
  const page = read("./app/bar/page.tsx")
  const card = read("./components/bar-order-card.tsx")
  assert.match(page, />\s*ACTIVE\s*</)
  assert.match(page, /\/bar\/orders\/\$\{orderId\}\/fulfillment/)
  assert.match(page, /orderLineIds/)
  assert.match(page, /response\.data\.order/)
  assert.match(card, /MARK READY TO SERVE/)
  assert.match(card, /START PREPARATION/)
  assert.match(card, /MARK PREPARED DRINKS READY/)
  assert.match(card, /item\.fulfillmentBehavior === "prepared" \? "Requires preparation" : "Ready to serve"/)
  assert.match(card, /idsFor\("prepared", "pending"\)/)
  assert.match(card, /runAction\("start", preparedPendingIds\)/)
  assert.match(card, /idsFor\("direct", "pending"\)/)
  assert.match(card, /runAction\("ready", directPendingIds\)/)
  assert.doesNotMatch(card, /paymentChannel/)
  assert.doesNotMatch(card, /Read-Only View/)
  assert.doesNotMatch(card, /Managed by Kitchen/)
})

test("guest keeps one four-step status bar and receives only public messaging", () => {
  const source = read("./app/s/[servicePointId]/status/page.tsx")
  assert.doesNotMatch(source, /isDrinksOnly/)
  assert.match(source, />Placed</)
  assert.match(source, />In Progress</)
  assert.match(source, />Ready</)
  assert.match(source, />Served</)
  assert.match(source, /getCustomerOrderProgress\(order\)/)
  assert.match(source, /getCustomerOrderPresentation\(customerProgress, nowMs\)/)
  assert.match(source, /presentation\.headline/)
  assert.match(source, /presentation\.secondaryMessage/)
  assert.match(source, /presentation\.overallEstimatedReadyAt/)
  assert.match(source, /presentation\.stationEtas/)
  assert.doesNotMatch(source, /Kitchen pending/)
  assert.doesNotMatch(source, /Bar ready/)
  assert.doesNotMatch(source, /fulfillmentBehavior/)
  assert.match(source, /order_updated:/)
})

test("widget and status page share the canonical customer progress projection", () => {
  const widget = read("./components/order-eta-widget.tsx")
  const status = read("./app/s/[servicePointId]/status/page.tsx")
  const helper = read("./lib/customer-order-progress.ts")

  assert.match(widget, /getCustomerOrderProgress\(order\)/)
  assert.match(widget, /getCustomerOrderPresentation\(customerProgress, nowMs\)/)
  assert.match(status, /getCustomerOrderProgress\(order\)/)
  assert.match(helper, /order\.customerProgress\?\.headline/)
  assert.match(helper, /etaMode: "none"/)
  assert.doesNotMatch(widget, /syntheticReadyMs/)
  assert.doesNotMatch(widget, /newReadyMs/)
  assert.doesNotMatch(widget, /formatCountdown\(order\.estimatedReadyAt/)
})

test("placed widget uses a complete neutral received-state ring without inventing progress", () => {
  const widget = read("./components/order-eta-widget.tsx")
  const helper = read("./lib/customer-order-progress.ts")

  assert.match(widget, /order\.status === "placed" \? "Order Received" : "In Progress"/)
  assert.match(widget, /order\.status === "placed" \? "text-stone-200\/80 dark:text-stone-700\/70" : copy\.bgRingColor/)
  assert.match(widget, /order\.status !== "placed" && \(/)
  assert.match(widget, /countdown && order\.status !== "placed" \? \(/)
  assert.match(widget, /motion-safe:animate-\[pulse_3\.5s_ease-in-out_infinite\]/)
  assert.match(helper, /headline: "Your order is confirmed\."/)
  assert.match(helper, /secondaryMessage: status === "placed" \? "Waiting for preparation to begin\." : null/)
  assert.doesNotMatch(widget, /formatCountdown\(order\.estimatedReadyAt/)
  assert.doesNotMatch(widget, /paymentChannel/)
})

test("waitstaff remains the final handoff surface", () => {
  const source = read("./app/waitstaff/page.tsx")
  const history = read("./app/waitstaff/past-orders/page.tsx")
  assert.match(source, /\/waitstaff\/orders\/\$\{orderId\}\/status/)
  assert.match(source, /status: "completed"/)
  assert.match(source, /Order marked as served/)
  assert.match(history, /return order\.status === "ready"/)
})
