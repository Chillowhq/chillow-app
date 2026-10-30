import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  appendNotificationPage,
  applyNotificationReadSuccess,
  applyReadThroughSuccess,
  formatUnreadBadge,
  resolveOwnerNotificationDestination,
} from "./lib/owner-notification-contract.mjs"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

function notification(overrides = {}) {
  return {
    notificationId: "notice-1",
    entityType: "reservation",
    entityId: "reservation-1",
    createdAt: "2026-09-08T18:00:00.000Z",
    readAt: null,
    read: false,
    ...overrides,
  }
}

test("unread badge hides at zero and caps visually at 99+", () => {
  assert.equal(formatUnreadBadge(0), null)
  assert.equal(formatUnreadBadge(7), "7")
  assert.equal(formatUnreadBadge(99), "99")
  assert.equal(formatUnreadBadge(100), "99+")
})

test("cursor pages append in stable order without duplicates", () => {
  const first = [notification(), notification({ notificationId: "notice-2" })]
  const next = [
    notification({ notificationId: "notice-2" }),
    notification({ notificationId: "notice-3" }),
  ]
  assert.deepEqual(
    appendNotificationPage(first, next).map((item) => item.notificationId),
    ["notice-1", "notice-2", "notice-3"],
  )
})

test("read success changes only the confirmed notification", () => {
  const current = [notification(), notification({ notificationId: "notice-2" })]
  const confirmed = notification({
    read: true,
    readAt: "2026-09-08T18:05:00.000Z",
  })
  const result = applyNotificationReadSuccess(current, confirmed)
  assert.equal(result[0].read, true)
  assert.equal(result[1].read, false)
})

test("mark all applies only through the server-provided cutoff", () => {
  const result = applyReadThroughSuccess([
    notification({ notificationId: "before", createdAt: "2026-09-08T17:59:59.000Z" }),
    notification({ notificationId: "after", createdAt: "2026-09-08T18:00:01.000Z" }),
  ], "2026-09-08T18:00:00.000Z", "2026-09-08T18:05:00.000Z")
  assert.equal(result[0].read, true)
  assert.equal(result[1].read, false)
})

test("deep links are allowlisted by entity type and never accept arbitrary URLs", () => {
  assert.equal(resolveOwnerNotificationDestination(notification()), "/owner/reservations?reservationId=reservation-1")
  assert.equal(
    resolveOwnerNotificationDestination(notification({ metadata: { reservationMode: "stay" } })),
    "/owner/reservations?reservationId=reservation-1&mode=stay",
  )
  assert.equal(
    resolveOwnerNotificationDestination(notification({ metadata: { reservationMode: "unsupported" } })),
    "/owner/reservations?reservationId=reservation-1",
  )
  assert.equal(resolveOwnerNotificationDestination(notification({ entityType: "inventory_item", entityId: "item/1" })), "/owner/inventory/items?inventoryItemId=item%2F1")
  assert.equal(resolveOwnerNotificationDestination(notification({ entityType: "feedback", entityId: "feedback-1" })), "/owner/feedback?feedbackId=feedback-1")
  assert.equal(resolveOwnerNotificationDestination(notification({ entityType: "billing_invoice", entityId: "invoice-1" })), "/owner/billing?tab=billing&invoiceId=invoice-1")
  assert.equal(resolveOwnerNotificationDestination(notification({ entityType: "business", entityId: "biz" })), "/owner/billing?tab=billing")
  assert.equal(resolveOwnerNotificationDestination(notification({ entityType: "https://evil.example", entityId: "x" })), null)
  assert.equal(resolveOwnerNotificationDestination(notification({ entityType: "reservation", entityId: "" })), null)
})

test("owner reservations use URL-backed mode tabs and mode-specific dashboards", async () => {
  const [page, hook] = await Promise.all([
    read("./app/owner/reservations/page.tsx"),
    read("./components/reservations/dashboard/useReservationDashboard.ts"),
  ])
  assert.match(page, /useSearchParams/)
  assert.match(page, /role="tablist"/)
  assert.match(page, /params\.set\("mode", mode\)/)
  assert.match(page, /<HotelReservationsDashboard key="stay"/)
  assert.match(page, /<RestaurantReservationsDashboard key="timeslot"/)
  assert.match(hook, /reservationMode/)
})

test("notification controller uses authoritative APIs, SSE invalidation, and recovery triggers", async () => {
  const [hook, api, eventSource] = await Promise.all([
    read("./hooks/use-owner-notifications.ts"),
    read("./lib/owner-notifications-api.ts"),
    read("./hooks/use-event-source.ts"),
  ])

  assert.match(api, /limit: OWNER_NOTIFICATION_PAGE_SIZE/)
  assert.match(api, /\/owner\/notifications\/unread-count/)
  assert.match(api, /\/owner\/notifications\/read-all/)
  assert.match(hook, /notification_changed: \(\) => recoverAuthoritativeState\(\)/)
  assert.match(hook, /onReconnect: recoverAuthoritativeState/)
  assert.match(hook, /window\.addEventListener\("focus"/)
  assert.match(hook, /window\.addEventListener\("online"/)
  assert.match(eventSource, /visibilitychange/)
  assert.match(hook, /markAllOwnerNotificationsRead\(readThrough\)/)
  assert.match(hook, /Keep the first-page cutoff/)
  assert.match(hook, /catch \(error\)[\s\S]*could not be marked as read/)
})

test("desktop and mobile surfaces cover loading, empty, error, populated, and accessible actions", async () => {
  const [component, layout] = await Promise.all([
    read("./components/owner/notifications/OwnerNotificationCenter.tsx"),
    read("./app/owner/layout.tsx"),
  ])

  assert.match(component, /<Popover/)
  assert.match(component, /<Sheet/)
  assert.match(component, /h-\[100dvh\] w-full max-w-full/)
  assert.match(component, /<Skeleton/)
  assert.match(component, /You&apos;re all caught up/)
  assert.match(component, /Notifications are temporarily unavailable/)
  assert.match(component, /\bRetry\b/)
  assert.match(component, /controller\.notifications\.map/)
  assert.match(component, /Mark all as read/)
  assert.match(component, /Load more/)
  assert.match(component, /aria-label=\{label\}/)
  assert.match(component, /aria-live="polite"/)
  assert.match(component, /aria-label="Close notifications"/)
  assert.match(component, /aria-label=\{`\$\{notification\.title\}/)
  assert.match(component, /onOpenAutoFocus/)
  assert.match(layout, /variant="desktop"/)
  assert.match(layout, /variant="mobile"/)
})

test("destination pages provide narrow entity identification and graceful inaccessible states", async () => {
  const [inventory, restaurant, hotel, feedback, billing] = await Promise.all([
    read("./app/owner/inventory/items/page.tsx"),
    read("./components/reservations/RestaurantReservationsDashboard.tsx"),
    read("./components/reservations/HotelReservationsDashboard.tsx"),
    read("./app/owner/feedback/page.tsx"),
    read("./app/owner/billing/page.tsx"),
  ])
  assert.match(inventory, /searchParams\.get\("inventoryItemId"\)/)
  assert.match(restaurant, /params: \{ reservationId, mode: "timeslot" \}/)
  assert.match(hotel, /params: \{ reservationId, mode: "stay" \}/)
  assert.match(restaurant, /no longer available or you do not have access/)
  assert.match(hotel, /no longer available or you do not have access/)
  assert.match(feedback, /data-feedback-id/)
  assert.match(billing, /data-invoice-ids/)
})
