import { apiClient } from "@/lib/axios-config"
import type {
  MarkAllNotificationsReadResult,
  OwnerNotification,
  OwnerNotificationPage,
} from "@/types/owner-notifications"

export const OWNER_NOTIFICATION_PAGE_SIZE = 10

export async function getOwnerNotifications(cursor?: string | null) {
  const response = await apiClient.get<OwnerNotificationPage>("/owner/notifications", {
    params: {
      limit: OWNER_NOTIFICATION_PAGE_SIZE,
      cursor: cursor || undefined,
    },
  })
  return response.data
}

export async function getOwnerUnreadNotificationCount() {
  const response = await apiClient.get<{ unreadCount: number }>(
    "/owner/notifications/unread-count",
  )
  return response.data
}

export async function markOwnerNotificationRead(notificationId: string) {
  const response = await apiClient.patch<{ notification: OwnerNotification }>(
    `/owner/notifications/${encodeURIComponent(notificationId)}/read`,
  )
  return response.data
}

export async function markAllOwnerNotificationsRead(readThrough: string) {
  const response = await apiClient.post<MarkAllNotificationsReadResult>(
    "/owner/notifications/read-all",
    { readThrough },
  )
  return response.data
}

