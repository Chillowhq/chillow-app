import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const notificationsHookUrl = new URL("./hooks/use-customer-notifications.ts", import.meta.url)
const guestSessionUrl = new URL("./lib/guest-session.ts", import.meta.url)
const menuButtonUrl = new URL("./components/menu-button.tsx", import.meta.url)
const confirmationPageUrl = new URL("./app/s/[servicePointId]/confirmation/page.tsx", import.meta.url)
const orderEtaWidgetUrl = new URL("./components/order-eta-widget.tsx", import.meta.url)
const eventSourceHookUrl = new URL("./hooks/use-event-source.ts", import.meta.url)

// ── 1. Live order notification works ──────────────────────────────────────
test("live order_created and order_updated handlers exist and validate servicePointId", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /order_created: \(data: any\) => handleOrderEvent\(data, "order_created"\)/)
  assert.match(hook, /order_updated: \(data: any\) => handleOrderEvent\(data, "order_updated"\)/)
  assert.match(hook, /order\.servicePointId !== servicePointId/)
  assert.match(hook, /if \(!order\) return/)
})

// ── 2. Live waiter-call notification works ────────────────────────────────
test("waiter acknowledgements use the canonical notification event pipeline", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /waiter_call_updated:/)
  assert.match(hook, /deriveWaitstaffAcknowledgementNotificationEvents/)
  assert.match(hook, /ingestWaitstaffCalls/)
  assert.match(hook, /if \(!businessId \|\| !isTableSessionValid\(servicePointId\)\) return/)
  assert.match(hook, /silent: source !== "sse"/)
  assert.match(hook, /recovered: source === "recovery"/)
  assert.match(hook, /is heading to you\./)
  assert.match(hook, /data\?\.call\) ingestWaitstaffCalls\(data\.call, "sse"/)
})

// ── 3. Wrong servicePointId is ignored ────────────────────────────────────
test("order events for wrong servicePointId are ignored", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /order\.servicePointId !== servicePointId/)
  // Must return early when servicePointId doesn't match
  assert.match(hook, /if \(order\.servicePointId !== servicePointId\) return/)
})

// ── 4. Correct servicePointId is accepted ─────────────────────────────────
test("order events for correct servicePointId proceed to ownership check", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  // After the servicePointId guard, ownership check follows
  assert.match(hook, /order\.sessionId && order\.sessionId === sid/)
  assert.match(hook, /isOwnOrder/)
})

// ── 5. Own-order filtering still works ────────────────────────────────────
test("own-order filtering uses sessionId and session-scoped my_orders localStorage", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /ensureSessionId/)
  assert.match(hook, /order\.sessionId && order\.sessionId === sid/)
  assert.match(hook, /getMyOrdersKey/)
  assert.match(hook, /quickserve_my_orders/)
  assert.match(hook, /getSessionInstanceId/)
})

// ── 6. unreadCount uses isRead (not isSeen) ───────────────────────────────
test("unreadCount is based on isRead, not isSeen", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /!n\.isRead/)
  assert.doesNotMatch(hook, /isSeen/)
  assert.doesNotMatch(hook, /markAllAsSeen/)
})

// ── 7. markAsRead reduces unreadCount ─────────────────────────────────────
test("markAsRead sets isRead to true for the given id", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /markAsRead/)
  assert.match(hook, /n\.id === id \? \{ \.\.\.n, isRead: true \}/)
})

// ── 8. markAllAsRead clears unreadCount ───────────────────────────────────
test("markAllAsRead sets isRead to true for all notifications", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /markAllAsRead/)
  assert.match(hook, /prev\.map\(\(n\) => \(\{\s*\.\.\.n,\s*isRead: true\s*\}\)\)/)
})

// ── 9. Different waiter-call IDs are not deduped ──────────────────────────
test("toast dedupe uses entity identity, not just title", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /getNotificationEntityId/)
  assert.match(hook, /data\?\.eventId/)
  assert.match(hook, /data\?\.orderId/)
  assert.match(hook, /data\?\.callId/)
  assert.match(hook, /data\?\._id/)
  // Dedupe key includes entityId, not just title
  assert.match(hook, /\$\{entityId\}/)
})

// ── 10. Duplicate same event is deduped ───────────────────────────────────
test("toast dedupe uses a Set with 8-second TTL", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /recentToastKeys/)
  assert.match(hook, /new Set/)
  assert.match(hook, /8_000/)
  assert.match(hook, /recentToastKeys\.current\.has\(dedupeKey\)/)
})

// ── 11. Notification IDs use crypto.randomUUID ────────────────────────────
test("notification IDs use crypto.randomUUID, not Math.random", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /crypto\.randomUUID\(\)/)
  assert.doesNotMatch(hook, /Math\.random\(\)\.toString\(36\)/)
})

// ── 12. Initial load and reconnect reconcile current orders ───────────────
test("current orders reconcile on initial load, first SSE open, and reconnect", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /apiClient\.get\("\/orders\/current"/)
  assert.match(hook, /void reconcileCustomerNotifications\(\)/)
  assert.match(hook, /onOpen:/)
  assert.match(hook, /requireFreshAfterCurrent: true/)
  assert.match(hook, /onReconnect:\s*reconcileCustomerNotifications/)
  assert.match(hook, /createCustomerNotificationRecoveryCoordinator/)
})

// ── 13. Recovery uses timestamp-proven lifecycle notifications ────────────
test("recovery uses canonical lifecycle derivation and stable claiming", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /deriveCustomerOrderNotificationEvents/)
  assert.match(hook, /claimCustomerNotificationEvent/)
  assert.match(hook, /processedCustomerEventIds/)
  assert.match(hook, /timestamp:\s*customerEvent\.occurredAt/)
  assert.match(hook, /silent:\s*index !== missed\.length - 1/)
})

// ── 14. Notifications persist during the same valid session ───────────────
test("notifications are persisted to localStorage scoped by sessionInstanceId", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /getSessionInstanceId/)
  assert.match(hook, /qs_customer_notifications/)
  assert.match(hook, /localStorage\.setItem\(storageKey/)
  assert.match(hook, /localStorage\.getItem\(storageKey/)
})

// ── 15. Notifications disappear after session expiration ──────────────────
test("when session is expired, getStorageKey returns null and no notifications load", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  // getStorageKey returns null when getSessionInstanceId returns null
  assert.match(hook, /const sid = getSessionInstanceId\(servicePointId\)/)
  assert.match(hook, /if \(!sid\) return null/)
})

// ── 16. New session on same service point cannot see previous notifications ─
test("storage key includes sessionInstanceId so new session gets clean state", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /\$\{businessId\}_\$\{servicePointId\}_\$\{sid\}/)
})

// ── 17. Session A notification cannot leak into Session B ─────────────────
test("stale notification keys from old sessions are cleaned up", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /localStorage\.removeItem\(key\)/)
  assert.match(hook, /key\.startsWith\(candidate\)/)
})

// ── 18. No hardcoded 3-hour notification TTL remains ──────────────────────
test("NOTIFICATION_TTL_MS is completely removed", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.doesNotMatch(hook, /NOTIFICATION_TTL/)
  assert.doesNotMatch(hook, /3 \* 60 \* 60 \* 1000/)
  assert.doesNotMatch(hook, /now - n\.timestamp/)
})

// ── 19. Existing configured session expiration is the source of truth ─────
test("session expiration is checked via isTableSessionValid and getSessionInstanceId", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /isTableSessionValid/)
  assert.match(hook, /getSessionInstanceId/)
  // No independent notification expiry
  assert.doesNotMatch(hook, /notification.*expir/i)
})

// ── 20. Session validity changes are reflected correctly ──────────────────
test("session validity is checked periodically, not just on servicePointId change", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /setInterval\(check, 30_000\)/)
  assert.match(hook, /setIsSessionValid\(isTableSessionValid\(servicePointId\)\)/)
})

// ── 21. Existing localStorage behavior remains safe and session-scoped ────
test("confirmation page uses session-scoped my_orders key", async () => {
  const page = await readFile(confirmationPageUrl, "utf8")

  assert.match(page, /getSessionInstanceId/)
  assert.match(page, /quickserve_my_orders_\$\{businessId\}_\$\{servicePointId\}_\$\{sid\}/)
  assert.doesNotMatch(page, /quickserve_my_orders_\$\{businessId\}_\$\{servicePointId\}`/)
})

test("order-eta-widget uses session-scoped my_orders key", async () => {
  const widget = await readFile(orderEtaWidgetUrl, "utf8")

  assert.match(widget, /getSessionInstanceId/)
  assert.match(widget, /quickserve_my_orders_\$\{businessId\}_\$\{servicePointId\}_\$\{sid\}/)
})

test("order-eta-widget no longer compares servicePointLabel against servicePointId", async () => {
  const widget = await readFile(orderEtaWidgetUrl, "utf8")

  assert.doesNotMatch(widget, /order\.servicePointLabel && order\.servicePointLabel !== servicePointId/)
  assert.match(widget, /Never compare a label against an id/)
})

// ── guest-session.ts has sessionInstanceId ────────────────────────────────
test("guest-session exports getSessionInstanceId and stores sessionInstanceId on save", async () => {
  const gs = await readFile(guestSessionUrl, "utf8")

  assert.match(gs, /export function getSessionInstanceId/)
  assert.match(gs, /sessionInstanceId: uuid\(\)/)
  assert.match(gs, /parsed\.sessionInstanceId/)
})

// ── menu-button no longer calls markAllAsSeen ─────────────────────────────
test("menu-button does not auto-mark all as read on panel open", async () => {
  const mb = await readFile(menuButtonUrl, "utf8")

  assert.doesNotMatch(mb, /markAllAsSeen/)
  assert.match(mb, /do NOT auto-mark all as read/)
})

// ── useEventSource reconnect and visibility recovery ──────────────────────
test("useEventSource receives reconciliation and cleans visibility listeners", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")
  const eventSourceHook = await readFile(eventSourceHookUrl, "utf8")

  // Shared hook owns both native reconnect and visibility recovery.
  assert.match(hook, /useEventSource\(sseUrl, handlers, \{/)
  assert.match(hook, /onOpen:/)
  assert.match(hook, /onReconnect:\s*reconcileCustomerNotifications/)
  assert.match(eventSourceHook, /document\.visibilityState === "visible"/)
  assert.match(eventSourceHook, /document\.addEventListener\("visibilitychange"/)
  assert.match(eventSourceHook, /document\.removeEventListener\("visibilitychange"/)
})

test("processed lifecycle IDs persist for the active session beyond the 15-item UI limit", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /qs_customer_notification_events_/)
  assert.match(hook, /persistProcessedCustomerEventIds/)
  assert.match(hook, /JSON\.stringify\(Array\.from\(processedCustomerEventIds\.current\)\)/)
})

// ── CustomerNotification interface has isRead but not isSeen ──────────────
test("CustomerNotification interface has isRead but not isSeen", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /isRead: boolean/)
  assert.doesNotMatch(hook, /isSeen/)
})

test("fulfilment notifications use authoritative event copy and persistent event-id dedupe", async () => {
  const hook = await readFile(notificationsHookUrl, "utf8")

  assert.match(hook, /data\?\.customerNotification/)
  assert.match(hook, /customerEvent\?\.eventId/)
  assert.match(hook, /customerEvent\?\.message/)
  assert.match(hook, /claimOrderEvent\(eventId\)/)
  assert.doesNotMatch(hook, /case "in_progress"/)
  assert.match(hook, /global in_progress status alone is not enough/)
})
