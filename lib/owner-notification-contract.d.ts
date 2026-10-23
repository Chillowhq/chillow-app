import type { OwnerNotification } from "@/types/owner-notifications"

export function formatUnreadBadge(unreadCount: number | null | undefined): string | null
export function appendNotificationPage(
  current: OwnerNotification[],
  incoming: OwnerNotification[],
): OwnerNotification[]
export function applyNotificationReadSuccess(
  notifications: OwnerNotification[],
  notification: OwnerNotification,
): OwnerNotification[]
export function applyReadThroughSuccess(
  notifications: OwnerNotification[],
  readThrough: string,
  readAt: string,
): OwnerNotification[]
export function resolveOwnerNotificationDestination(
  notification: Pick<OwnerNotification, "entityType" | "entityId">,
): string | null

