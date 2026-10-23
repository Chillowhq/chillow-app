export function formatUnreadBadge(unreadCount) {
  const normalized = Number.isFinite(Number(unreadCount))
    ? Math.max(0, Math.floor(Number(unreadCount)))
    : 0
  if (normalized === 0) return null
  return normalized > 99 ? "99+" : String(normalized)
}

export function appendNotificationPage(current, incoming) {
  const seen = new Set()
  return [...current, ...incoming].filter((notification) => {
    const id = notification?.notificationId
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function applyNotificationReadSuccess(notifications, notification) {
  return notifications.map((current) => (
    current.notificationId === notification.notificationId ? notification : current
  ))
}

export function applyReadThroughSuccess(notifications, readThrough, readAt) {
  const cutoff = new Date(readThrough).getTime()
  if (!Number.isFinite(cutoff)) return notifications
  return notifications.map((notification) => {
    if (notification.read) return notification
    const createdAt = new Date(notification.createdAt).getTime()
    if (!Number.isFinite(createdAt) || createdAt > cutoff) return notification
    return { ...notification, read: true, readAt }
  })
}

export function resolveOwnerNotificationDestination(notification) {
  const entityId = typeof notification?.entityId === "string"
    ? notification.entityId.trim()
    : ""
  const encodedId = encodeURIComponent(entityId)

  switch (notification?.entityType) {
    case "reservation":
      return entityId ? `/owner/reservations?reservationId=${encodedId}` : null
    case "inventory_item":
      return entityId ? `/owner/inventory/items?inventoryItemId=${encodedId}` : null
    case "feedback":
      return entityId ? `/owner/feedback?feedbackId=${encodedId}` : null
    case "billing_invoice":
      return entityId ? `/owner/billing?tab=billing&invoiceId=${encodedId}` : null
    case "business":
      return "/owner/billing?tab=billing"
    default:
      return null
  }
}

