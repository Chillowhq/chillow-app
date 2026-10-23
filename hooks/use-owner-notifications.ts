"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useEventSource } from "@/hooks/use-event-source"
import {
  getOwnerNotifications,
  getOwnerUnreadNotificationCount,
  markAllOwnerNotificationsRead,
  markOwnerNotificationRead,
} from "@/lib/owner-notifications-api"
import {
  appendNotificationPage,
  applyNotificationReadSuccess,
  applyReadThroughSuccess,
  resolveOwnerNotificationDestination,
} from "@/lib/owner-notification-contract.mjs"
import type { OwnerNotification } from "@/types/owner-notifications"

type NotificationSurface = "desktop" | "mobile" | null
type NotificationListStatus = "idle" | "loading" | "ready" | "error"

export type OwnerNotificationsController = {
  openSurface: NotificationSurface
  setSurfaceOpen: (surface: Exclude<NotificationSurface, null>, open: boolean) => void
  notifications: OwnerNotification[]
  unreadCount: number | null
  countError: boolean
  listStatus: NotificationListStatus
  listError: string | null
  actionError: string | null
  hasNextPage: boolean
  loadingMore: boolean
  markingNotificationId: string | null
  markingAll: boolean
  retry: () => void
  loadMore: () => Promise<void>
  selectNotification: (notification: OwnerNotification) => Promise<void>
  markAllRead: () => Promise<void>
}

function requestErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response
    if (typeof response?.data?.message === "string" && response.data.message.trim()) {
      return response.data.message
    }
  }
  return fallback
}

export function useOwnerNotifications(enabled: boolean): OwnerNotificationsController {
  const router = useRouter()
  const [openSurface, setOpenSurface] = useState<NotificationSurface>(null)
  const [notifications, setNotifications] = useState<OwnerNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [countError, setCountError] = useState(false)
  const [listStatus, setListStatus] = useState<NotificationListStatus>("idle")
  const [listError, setListError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [readThrough, setReadThrough] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const openSurfaceRef = useRef<NotificationSurface>(null)
  const pageRequestVersion = useRef(0)
  const actionLockRef = useRef(false)

  useEffect(() => {
    openSurfaceRef.current = openSurface
  }, [openSurface])

  const fetchUnreadCount = useCallback(async () => {
    if (!enabled) return
    try {
      const result = await getOwnerUnreadNotificationCount()
      setUnreadCount(Math.max(0, Number(result.unreadCount) || 0))
      setCountError(false)
    } catch {
      setCountError(true)
    }
  }, [enabled])

  const loadFirstPage = useCallback(async (showLoading = true) => {
    if (!enabled) return
    const requestVersion = ++pageRequestVersion.current
    if (showLoading) setListStatus("loading")
    setListError(null)
    setActionError(null)
    try {
      const result = await getOwnerNotifications()
      if (requestVersion !== pageRequestVersion.current) return
      setNotifications(result.notifications)
      setNextCursor(result.pagination.nextCursor)
      setHasNextPage(result.pagination.hasNextPage)
      setReadThrough(result.readThrough)
      setListStatus("ready")
    } catch (error) {
      if (requestVersion !== pageRequestVersion.current) return
      setListError(requestErrorMessage(error, "Notifications could not be loaded."))
      setListStatus("error")
    }
  }, [enabled])

  const recoverAuthoritativeState = useCallback(() => {
    if (!enabled) return
    void fetchUnreadCount()
    if (openSurfaceRef.current) {
      void loadFirstPage(false)
    }
  }, [enabled, fetchUnreadCount, loadFirstPage])

  const eventHandlers = useMemo(() => ({
    notification_changed: () => recoverAuthoritativeState(),
  }), [recoverAuthoritativeState])

  useEventSource(
    enabled ? "/owner/notifications/events" : "",
    eventHandlers,
    { onReconnect: recoverAuthoritativeState },
  )

  useEffect(() => {
    if (!enabled) return
    void fetchUnreadCount()
  }, [enabled, fetchUnreadCount])

  useEffect(() => {
    if (!enabled || !openSurface) return
    void loadFirstPage(notifications.length === 0)
    // Opening always refreshes page one; notification history is server-owned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, openSurface, loadFirstPage])

  useEffect(() => {
    if (!enabled) return
    const handleRecovery = () => recoverAuthoritativeState()
    window.addEventListener("focus", handleRecovery)
    window.addEventListener("online", handleRecovery)
    return () => {
      window.removeEventListener("focus", handleRecovery)
      window.removeEventListener("online", handleRecovery)
    }
  }, [enabled, recoverAuthoritativeState])

  const setSurfaceOpen = useCallback((surface: Exclude<NotificationSurface, null>, open: boolean) => {
    setOpenSurface(open ? surface : null)
  }, [])

  const retry = useCallback(() => {
    void fetchUnreadCount()
    void loadFirstPage(true)
  }, [fetchUnreadCount, loadFirstPage])

  const loadMore = useCallback(async () => {
    if (!enabled || !nextCursor || loadingMore) return
    const requestVersion = pageRequestVersion.current
    setLoadingMore(true)
    setActionError(null)
    try {
      const result = await getOwnerNotifications(nextCursor)
      if (requestVersion !== pageRequestVersion.current) return
      setNotifications((current) => appendNotificationPage(current, result.notifications))
      setNextCursor(result.pagination.nextCursor)
      setHasNextPage(result.pagination.hasNextPage)
      // Keep the first-page cutoff. A newer page request must not widen Mark all.
    } catch (error) {
      setActionError(requestErrorMessage(error, "More notifications could not be loaded."))
    } finally {
      setLoadingMore(false)
    }
  }, [enabled, loadingMore, nextCursor])

  const selectNotification = useCallback(async (notification: OwnerNotification) => {
    if (actionLockRef.current || markingNotificationId || markingAll) return
    setActionError(null)

    if (!notification.read) {
      actionLockRef.current = true
      setMarkingNotificationId(notification.notificationId)
      try {
        const result = await markOwnerNotificationRead(notification.notificationId)
        setNotifications((current) => applyNotificationReadSuccess(current, result.notification))
        setUnreadCount((current) => current === null ? current : Math.max(0, current - 1))
        void fetchUnreadCount()
      } catch (error) {
        setActionError(requestErrorMessage(error, "This notification could not be marked as read. Try again."))
        setMarkingNotificationId(null)
        actionLockRef.current = false
        return
      }
      setMarkingNotificationId(null)
      actionLockRef.current = false
    }

    const destination = resolveOwnerNotificationDestination(notification)
    if (!destination) {
      setActionError("This notification destination is no longer available.")
      return
    }
    setOpenSurface(null)
    router.push(destination)
  }, [fetchUnreadCount, markingAll, markingNotificationId, router])

  const markAllRead = useCallback(async () => {
    if (!readThrough || actionLockRef.current || markingAll || markingNotificationId) return
    actionLockRef.current = true
    setMarkingAll(true)
    setActionError(null)
    try {
      const result = await markAllOwnerNotificationsRead(readThrough)
      setNotifications((current) => (
        applyReadThroughSuccess(current, result.readThrough, result.readAt)
      ))
      setUnreadCount((current) => (
        current === null ? current : Math.max(0, current - result.markedReadCount)
      ))
      void fetchUnreadCount()
    } catch (error) {
      setActionError(requestErrorMessage(error, "Notifications could not be marked as read. Try again."))
    } finally {
      setMarkingAll(false)
      actionLockRef.current = false
    }
  }, [fetchUnreadCount, markingAll, markingNotificationId, readThrough])

  return {
    openSurface,
    setSurfaceOpen,
    notifications,
    unreadCount,
    countError,
    listStatus,
    listError,
    actionError,
    hasNextPage,
    loadingMore,
    markingNotificationId,
    markingAll,
    retry,
    loadMore,
    selectNotification,
    markAllRead,
  }
}
