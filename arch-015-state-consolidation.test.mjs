import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import test from "node:test"

class MemoryStorage {
  constructor() {
    this.values = new Map()
  }

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null
  }

  key(index) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key) {
    this.values.delete(key)
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }
}

function installBrowserStorage() {
  const browserLocalStorage = new MemoryStorage()
  const browserSessionStorage = new MemoryStorage()
  Object.defineProperties(globalThis, {
    window: { value: {}, configurable: true, writable: true },
    localStorage: { value: browserLocalStorage, configurable: true, writable: true },
    sessionStorage: { value: browserSessionStorage, configurable: true, writable: true },
  })
  return { browserLocalStorage, browserSessionStorage }
}

let cartModuleSequence = 0
async function loadFreshCartStore() {
  cartModuleSequence += 1
  const moduleUrl = new URL(`./store/cart-store.ts?arch015=${cartModuleSequence}`, import.meta.url)
  return (await import(moduleUrl.href)).useCartStore
}

function menuItem(overrides = {}) {
  return {
    id: "item-a",
    name: "Soup",
    price: 9.5,
    image: "/soup.jpg",
    category: "starters",
    description: "Seasonal soup",
    quantity: 1,
    orderCategory: "food",
    ...overrides,
  }
}

const guestSession = await import(new URL("./lib/guest-session.ts?arch015=session", import.meta.url).href)
const orderHistoryStorage = await import(
  new URL("./lib/order-history-storage.ts?arch015=history", import.meta.url).href
)

test("canonical Zustand cart supports add, remove, quantity, and independent clears", async () => {
  installBrowserStorage()
  const useCartStore = await loadFreshCartStore()
  const item = menuItem()

  useCartStore.getState().addItem(item)
  useCartStore.getState().addItem(item)
  assert.equal(useCartStore.getState().items[0].quantity, 2)

  useCartStore.getState().removeItem(item.id)
  assert.equal(useCartStore.getState().items[0].quantity, 1)

  useCartStore.getState().setItemQuantity(item.id, 4)
  assert.equal(useCartStore.getState().items[0].quantity, 4)
  useCartStore.getState().setItemQuantity(item.id, 0)
  assert.deepEqual(useCartStore.getState().items, [])

  useCartStore.getState().addItem(item)
  useCartStore.getState().setAllergies(["nuts"])
  useCartStore.getState().setSpecialNotes("No salt")
  useCartStore.getState().setOrderType("dine-in")
  useCartStore.getState().clearCart()
  assert.deepEqual(useCartStore.getState().items, [])
  assert.deepEqual(useCartStore.getState().allergies, ["nuts"])
  assert.equal(useCartStore.getState().specialNotes, "No salt")

  useCartStore.getState().clearOrderDetails()
  assert.deepEqual(useCartStore.getState().allergies, [])
  assert.equal(useCartStore.getState().specialNotes, "")
  assert.equal(useCartStore.getState().orderType, null)
})

test("cart context isolates actor, business, and ServicePoint without clearing the same context", async () => {
  installBrowserStorage()
  const useCartStore = await loadFreshCartStore()
  const customerA = { actor: "customer", businessId: "biz-a", servicePointId: "sp-a" }

  useCartStore.getState().ensureContext(customerA)
  useCartStore.getState().addItem(menuItem())
  useCartStore.getState().setAllergies(["dairy"])
  useCartStore.getState().ensureContext(customerA)
  assert.equal(useCartStore.getState().items.length, 1)

  for (const nextContext of [
    { actor: "waitstaff", businessId: "biz-a", servicePointId: "sp-a" },
    { actor: "waitstaff", businessId: "biz-b", servicePointId: "sp-a" },
    { actor: "waitstaff", businessId: "biz-b", servicePointId: "sp-b" },
  ]) {
    useCartStore.getState().ensureContext(nextContext)
    assert.deepEqual(useCartStore.getState().items, [])
    assert.deepEqual(useCartStore.getState().allergies, [])
    assert.equal(useCartStore.getState().servicePointId, nextContext.servicePointId)
    assert.deepEqual(useCartStore.getState().context, nextContext)
    useCartStore.getState().addItem(menuItem({ id: `${nextContext.actor}-${nextContext.businessId}-${nextContext.servicePointId}` }))
    useCartStore.getState().setAllergies(["reset-check"])
  }
})

test("cart persistence round-trips through the canonical Zustand envelope", async () => {
  const { browserLocalStorage } = installBrowserStorage()
  const firstStore = await loadFreshCartStore()
  const context = { actor: "customer", businessId: "biz-a", servicePointId: "sp-a" }

  firstStore.getState().ensureContext(context)
  firstStore.getState().addItem(menuItem({ quantity: 2 }))
  firstStore.getState().setAllergies(["shellfish"])
  firstStore.getState().setSpecialNotes("Window seat")
  firstStore.getState().setOrderType("dine-in")

  const envelope = JSON.parse(browserLocalStorage.getItem("quickserve-cart"))
  assert.equal(envelope.version, 0)
  assert.equal(envelope.state.items[0].quantity, 2)
  assert.deepEqual(envelope.state.context, context)

  const hydratedStore = await loadFreshCartStore()
  assert.equal(hydratedStore.getState().items[0].quantity, 2)
  assert.deepEqual(hydratedStore.getState().allergies, ["shellfish"])
  assert.equal(hydratedStore.getState().specialNotes, "Window seat")
  assert.equal(hydratedStore.getState().orderType, "dine-in")
  assert.deepEqual(hydratedStore.getState().context, context)
})

test("legacy raw-array cart storage is ignored safely and replaced on the next canonical write", async () => {
  const { browserLocalStorage } = installBrowserStorage()
  browserLocalStorage.setItem("quickserve-cart", JSON.stringify([menuItem({ id: "legacy" })]))

  const useCartStore = await loadFreshCartStore()
  assert.deepEqual(useCartStore.getState().items, [])
  assert.equal(useCartStore.getState().context, null)

  useCartStore.getState().addItem(menuItem({ id: "canonical" }))
  const persisted = JSON.parse(browserLocalStorage.getItem("quickserve-cart"))
  assert.equal(persisted.version, 0)
  assert.equal(persisted.state.items[0].id, "canonical")
})

test("canonical device identity reuses existing IDs, creates once when absent, and is SSR-safe", () => {
  const { browserLocalStorage } = installBrowserStorage()
  browserLocalStorage.setItem("qs_session_id", "existing-device")
  assert.equal(guestSession.ensureSessionId(), "existing-device")
  assert.equal(guestSession.ensureSessionId(), "existing-device")

  browserLocalStorage.removeItem("qs_session_id")
  const created = guestSession.ensureSessionId()
  assert.match(created, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  assert.equal(guestSession.ensureSessionId(), created)

  delete globalThis.window
  assert.equal(guestSession.ensureSessionId(), null)
})

test("GuestSession tokens are isolated by ServicePoint, expire safely, and stay in sessionStorage", () => {
  const { browserLocalStorage, browserSessionStorage } = installBrowserStorage()
  const future = new Date(Date.now() + 60_000).toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()

  guestSession.saveTableToken("sp-a", "token-a", future)
  guestSession.saveTableToken("sp-b", "token-b", future)
  assert.equal(guestSession.getTableToken("sp-a"), "token-a")
  assert.equal(guestSession.getTableToken("sp-b"), "token-b")
  assert.equal(browserLocalStorage.getItem("qs_gs_sp-a"), null)
  assert.ok(browserSessionStorage.getItem("qs_gs_sp-a"))

  guestSession.saveTableToken("sp-expired", "expired-token", past)
  assert.equal(guestSession.getTableToken("sp-expired"), null)
  assert.equal(browserSessionStorage.getItem("qs_gs_sp-expired"), null)

  guestSession.clearTableToken("sp-a")
  assert.equal(guestSession.getTableToken("sp-a"), null)
  assert.equal(guestSession.getTableToken("sp-b"), "token-b")
})

test("Clear All History hides only terminal orders while preserving the active order and bound visit", async () => {
  const { browserLocalStorage, browserSessionStorage } = installBrowserStorage()
  const future = new Date(Date.now() + 60_000).toISOString()
  browserLocalStorage.setItem("qs_session_id", "bound-device")
  browserLocalStorage.setItem("hidden_orders_history", JSON.stringify(["completed-order"]))
  guestSession.saveTableToken("sp-current", "active-token", future)

  const orders = [
    { orderId: "completed-order", status: "completed" },
    { orderId: "cancelled-order", status: "cancelled" },
    { orderId: "placed-order", status: "placed" },
    { orderId: "in-progress-order", status: "in_progress" },
    { orderId: "ready-order", status: "ready" },
  ]
  const historicalOrderIds = orderHistoryStorage.getHistoricalOrderIds(orders)
  assert.deepEqual(historicalOrderIds, ["completed-order", "cancelled-order"])

  const hiddenOrderIds = orderHistoryStorage.hideOrderIds(historicalOrderIds)
  assert.deepEqual(hiddenOrderIds, ["completed-order", "cancelled-order"])
  assert.deepEqual(
    orders.filter((order) => !hiddenOrderIds.includes(order.orderId)).map((order) => order.orderId),
    ["placed-order", "in-progress-order", "ready-order"],
  )
  assert.equal(guestSession.ensureSessionId(), "bound-device")
  assert.equal(guestSession.getTableToken("sp-current"), "active-token")
  assert.ok(browserSessionStorage.getItem("qs_gs_sp-current"))
  assert.equal(browserLocalStorage.getItem("qs_gs_sp-current"), null)

  const page = await readFile(new URL("./app/s/[servicePointId]/orders/page.tsx", import.meta.url), "utf8")
  assert.match(page, /hideOrderIds\(historicalOrderIds\)/)
  assert.match(page, /router\.replace\(getTableMenuUrl\(servicePointId, bid\)\)/)
  assert.doesNotMatch(page, /clearDeviceSession|clearAllTableTokens|\/q\//)
})

test("obsolete Cart Context and duplicate device helper are removed", async () => {
  const [layout, cartStore, ...consumers] = await Promise.all([
    readFile(new URL("./app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("./store/cart-store.ts", import.meta.url), "utf8"),
    ...[
      "./hooks/use-customer-notifications.ts",
      "./components/feedback-modal.tsx",
      "./components/order-eta-widget.tsx",
      "./components/order-again-button.tsx",
      "./components/order-history.tsx",
      "./hooks/use-waitstaff-request.ts",
      "./app/s/[servicePointId]/status/page.tsx",
      "./app/s/[servicePointId]/confirmation/page.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  ])

  assert.doesNotMatch(layout, /CartProvider|CartContext|hooks\/use-cart/)
  assert.match(cartStore, /name: "quickserve-cart"/)
  for (const consumer of consumers) {
    assert.match(consumer, /ensureSessionId/)
    assert.doesNotMatch(consumer, /@\/lib\/session|getSessionId/)
  }
  await assert.rejects(access(new URL("./hooks/use-cart.tsx", import.meta.url)), { code: "ENOENT" })
  await assert.rejects(access(new URL("./lib/session.ts", import.meta.url)), { code: "ENOENT" })
})
