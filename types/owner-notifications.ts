export type OwnerNotificationCategory =
  | "reservations"
  | "feedback"
  | "inventory"
  | "billing"

export type OwnerNotificationSeverity = "info" | "warning" | "critical"

export type OwnerNotificationEntityType =
  | "reservation"
  | "feedback"
  | "inventory_item"
  | "billing_invoice"
  | "business"

export type OwnerNotification = {
  notificationId: string
  type: string
  category: OwnerNotificationCategory
  title: string
  message: string
  severity: OwnerNotificationSeverity
  entityType: OwnerNotificationEntityType
  entityId: string
  occurredAt: string
  createdAt: string
  readAt: string | null
  read: boolean
  metadata: Record<string, unknown>
}

export type OwnerNotificationPage = {
  notifications: OwnerNotification[]
  pagination: {
    limit: number
    hasNextPage: boolean
    nextCursor: string | null
  }
  readThrough: string
}

export type MarkAllNotificationsReadResult = {
  markedReadCount: number
  readAt: string
  readThrough: string
}

