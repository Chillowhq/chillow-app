import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [
  cartBar,
  menuView,
  cartStore,
  customerCheckout,
  waitstaffCheckout,
] = await Promise.all([
  readFile(new URL("./components/cart-bar.tsx", import.meta.url), "utf8"),
  readFile(new URL("./components/table-menu-view.tsx", import.meta.url), "utf8"),
  readFile(new URL("./store/cart-store.ts", import.meta.url), "utf8"),
  readFile(new URL("./app/s/[servicePointId]/order/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("./app/waitstaff/take-order/[servicePointId]/checkout/page.tsx", import.meta.url), "utf8"),
])

test("waitstaff and customers leave the shared CartBar through actor-specific routes", () => {
  assert.match(cartBar, /isWaiterMode\s*\?\s*`\/waitstaff\/take-order\/\$\{servicePointId\}\/checkout`/)
  assert.match(cartBar, /:\s*`\/s\/\$\{servicePointId\}\/order`/)
  assert.doesNotMatch(cartBar, /waiterMode=true/)
})

test("legacy waiterMode links redirect safely while customer checkout remains customer-only", () => {
  assert.match(customerCheckout, /searchParams\.get\("waiterMode"\) === "true"/)
  assert.match(customerCheckout, /router\.replace\(`\/waitstaff\/take-order\/\$\{servicePointId\}\/checkout`\)/)
  assert.match(customerCheckout, /apiClient\.post\("\/orders"/)
  assert.match(customerCheckout, /apiClient\.post\("\/payments\/checkout"/)
  assert.doesNotMatch(customerCheckout, /apiClient\.post\("\/waitstaff\/orders"/)
})

test("staff review uses only the canonical waitstaff endpoint and operational actions", () => {
  assert.match(waitstaffCheckout, /Order Review/)
  assert.match(waitstaffCheckout, /Send to Kitchen/)
  assert.match(waitstaffCheckout, /Collect Payment First/)
  assert.match(waitstaffCheckout, /How did the guest pay\?/)
  assert.match(waitstaffCheckout, />\s*Cash\s*</)
  assert.match(waitstaffCheckout, />\s*POS Card\s*</)
  assert.match(waitstaffCheckout, /Confirm Payment & Send to Kitchen/)
  assert.match(waitstaffCheckout, /apiClient\.post\("\/waitstaff\/orders"/)
  assert.match(waitstaffCheckout, /paymentMethod: selectedPaymentMethod/)
  assert.doesNotMatch(waitstaffCheckout, /\/payments\/checkout|Pay with Card|Stripe/i)
})

test("staff payment-first is protected against rapid duplicate submission", () => {
  assert.match(waitstaffCheckout, /orderIdempotencyKey\.current = orderIdempotencyKey\.current \|\| crypto\.randomUUID\(\)/)
  assert.match(waitstaffCheckout, /headers: \{ "Idempotency-Key": orderIdempotencyKey\.current \}/)
  assert.match(waitstaffCheckout, /disabled=\{isLoading\}/)
  assert.match(waitstaffCheckout, /disabled=\{!paymentMethod \|\| isLoading\}/)
  assert.match(waitstaffCheckout, /Only show success after backend confirms|toast\.success/)
})

test("staff payment-first surfaces service-type and submission errors inside the dialog", () => {
  assert.match(waitstaffCheckout, /Choose Dine-In or Takeout before sending this order\./)
  assert.match(waitstaffCheckout, /setPaymentDialogError\(message\)/)
  assert.match(waitstaffCheckout, /toast\.error\(message\)/)
  assert.match(waitstaffCheckout, /role="alert"/)
  assert.match(waitstaffCheckout, /aria-live="assertive"/)
  assert.match(waitstaffCheckout, /setPaymentDialogError\(submissionError\)/)
})

test("one persisted cart is isolated by actor, business, and ServicePoint", () => {
  assert.match(cartStore, /type CartActor = "customer" \| "waitstaff"/)
  assert.match(cartStore, /current\.actor === next\.actor/)
  assert.match(cartStore, /current\.businessId === next\.businessId/)
  assert.match(cartStore, /current\.servicePointId === next\.servicePointId/)
  assert.match(cartStore, /if \(isSameContext\(state\.context, context\)\) return state/)
  assert.match(cartStore, /items: \[\][\s\S]*allergies: \[\][\s\S]*specialNotes: ""[\s\S]*orderType: null/)
  assert.match(cartStore, /name: "quickserve-cart"/)
})

test("the shared menu establishes actor context without staff guest-session side effects", () => {
  assert.match(menuView, /actor: isWaiterMode \? "waitstaff" : "customer"/)
  assert.match(menuView, /businessId,[\s\S]*servicePointId,/)
  assert.match(menuView, /if \(!isWaiterMode && businessId\) saveBusinessId\(businessId\)/)
  assert.match(menuView, /if \(isWaiterMode\) return[\s\S]*ensureSessionId\(\)/)
})
