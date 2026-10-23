"use client"

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react"
import { useEventSource } from "./use-event-source"
import { useParams } from "next/navigation"
import { getBusinessId } from "@/lib/business-info"
import { ensureSessionId, isTableSessionValid, getTableToken, getSessionInstanceId } from "@/lib/guest-session"
import { apiClient } from "@/lib/axios-config"
import { toast } from "sonner"
import {
  claimCustomerNotificationEvent,
  createCustomerNotificationRecoveryCoordinator,
  deriveCustomerOrderNotificationEvents,
  isCustomerNotificationOrderInContext,
  sortCustomerNotificationEvents,
} from "@/lib/customer-notification-reconciliation"
import {
  deriveWaitstaffAcknowledgementNotificationEvents,
  type WaitstaffNotificationSource,
} from "@/lib/waitstaff-customer-notification-reconciliation"
import type { IncomingWaiterCall } from "@/lib/waitstaff-request-reconciliation"
import type {
  CustomerNotificationOrder,
} from "@/lib/customer-notification-reconciliation"

export interface CustomerNotification {
  id: string
  type: "ORDER_UPDATE" | "WAITER_CALL"
  title: string
  subtitle: string
  timestamp: number
  isRead: boolean
  data?: any
  actionUrl?: string
}

const MAX_NOTIFICATIONS = 15

/** Emoji icons keyed by notification title */
const TOAST_ICON: Record<string, string> = {
  "Order placed":            "🍽️",
  "Order in progress":       "👨‍🍳",
  "Food is being prepared":  "👨‍🍳",
  "Drinks are being prepared": "🍹",
  "Food ready":              "✅",
  "Drinks ready":            "✅",
  "Order ready!":            "✅",
  "Order completed":         "🎉",
  "Order cancelled":         "X",
  "Payment Confirmed":       "💳",
  "A Waitstaff is on the way": "🛎️",
  "Waiter Update":           "🛎️",
}

/** Titles that should render as a success (green) toast */
const SUCCESS_TITLES = new Set([
  "Order ready!",
  "Order completed",
  "Food ready",
  "Drinks ready",
  "Payment Confirmed",
])

let customerNotificationAudio: HTMLAudioElement | null = null

const playNotificationSound = () => {
  try {
    customerNotificationAudio ??= new Audio("/sounds/bell-sound-1.mp3")
    customerNotificationAudio.currentTime = 0
    customerNotificationAudio.play().catch((error) => {
      console.warn("Customer notification audio playback failed", error)
    })
  } catch (error) {
    console.warn("Customer notification audio playback failed", error)
  }
}

/** Maps lifecycle events that do not need station context. */
function mapOrderStatusNotification(status: string): { title: string; subtitle: string } | null {
  switch (status) {
    case "placed":      return { title: "Order placed",      subtitle: "We have received your order." }
    case "cancelled":   return { title: "Order cancelled",    subtitle: "This order was cancelled." }
    default:            return null
  }
}

/**
 * Build a stable entity identity for toast deduplication.
 * Prefers a real backend eventId, falling back to orderId, callId, etc.
 * Two unrelated events MUST NOT suppress one another.
 */
function getNotificationEntityId(data: any): string {
  return (
    data?.eventId ??
    data?.orderId ??
    data?.callId ??
    data?.requestId ??
    data?._id ??
    ""
  )
}

export function useCustomerNotifications() {
  const params = useParams()
  const servicePointId = params.servicePointId as string
  const [businessId, setBusinessId] = useState<string>("")
  const [notifications, setNotifications] = useState<CustomerNotification[]>([])
  const [hasNewPulse, setHasNewPulse] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [feedbackOrder, setFeedbackOrder] = useState<any>(null)
  // Session validity – checked client-side only (sessionStorage is not SSR-safe)
  const [isSessionValid, setIsSessionValid] = useState(false)
  const processedCustomerEventIds = useRef<Set<string>>(new Set())
  const recoveryCoordinator = useRef<ReturnType<
    typeof createCustomerNotificationRecoveryCoordinator
  > | null>(null)
  recoveryCoordinator.current ??= createCustomerNotificationRecoveryCoordinator()

  // Safely get businessId from sessionStorage after hydration
  useEffect(() => {
    const id = getBusinessId()
    if (id && id !== "undefined" && id !== "null") {
      setBusinessId(id)
    }
  }, [])

  // Check session validity on mount, when servicePointId changes, and
  // periodically (every 30 s) so that natural session expiry is detected
  // without requiring a servicePointId change.
  useEffect(() => {
    if (!servicePointId) return

    const check = () => setIsSessionValid(isTableSessionValid(servicePointId))
    check()

    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [servicePointId])

  // ── Session-scoped storage key ──────────────────────────────────────────
  // Notifications are scoped to the active table-session instance so that a
  // new QR scan (which creates a new sessionInstanceId) starts with a clean
  // notification center.
  const getStorageKey = useCallback(() => {
    if (!businessId || !servicePointId) return null
    const sid = getSessionInstanceId(servicePointId)
    if (!sid) return null
    return `qs_customer_notifications_${businessId}_${servicePointId}_${sid}`
  }, [businessId, servicePointId])

  const getProcessedEventsStorageKey = useCallback(() => {
    if (!businessId || !servicePointId) return null
    const sid = getSessionInstanceId(servicePointId)
    if (!sid) return null
    return `qs_customer_notification_events_${businessId}_${servicePointId}_${sid}`
  }, [businessId, servicePointId])

  // ── Session-scoped my-orders key ────────────────────────────────────────
  const getMyOrdersKey = useCallback(() => {
    if (!businessId || !servicePointId) return null
    const sid = getSessionInstanceId(servicePointId)
    if (!sid) return null
    return `quickserve_my_orders_${businessId}_${servicePointId}_${sid}`
  }, [businessId, servicePointId])

  // Load from localStorage on mount (once businessId is known).
  // Only loads notifications belonging to the CURRENT session instance.
  // If the session has expired, no key is returned and we start clean.
  useEffect(() => {
    const storageKey = getStorageKey()
    const processedEventsStorageKey = getProcessedEventsStorageKey()
    processedCustomerEventIds.current = new Set()
    if (!storageKey) {
      setIsLoaded(true)
      return
    }

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as CustomerNotification[]
        parsed.forEach((notification) => {
          const eventId = notification.data?.eventId
          if (eventId) processedCustomerEventIds.current.add(String(eventId))
        })
        setNotifications(parsed)
      }
      if (processedEventsStorageKey) {
        const storedEventIds = localStorage.getItem(processedEventsStorageKey)
        const parsedEventIds = storedEventIds ? JSON.parse(storedEventIds) : []
        if (Array.isArray(parsedEventIds)) {
          parsedEventIds.forEach((eventId) => {
            if (typeof eventId === "string" && eventId) {
              processedCustomerEventIds.current.add(eventId)
            }
          })
        }
        localStorage.setItem(
          processedEventsStorageKey,
          JSON.stringify(Array.from(processedCustomerEventIds.current)),
        )
      }
    } catch (err) {
      console.error("Failed to load notifications", err)
    }
    setIsLoaded(true)
  }, [getProcessedEventsStorageKey, getStorageKey])

  // Save to localStorage when updated, but only after initial load is complete
  useEffect(() => {
    const storageKey = getStorageKey()
    if (isLoaded && storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(notifications))
      } catch (err) {
        console.error("Failed to save notifications", err)
      }
    }
  }, [notifications, isLoaded, getStorageKey])

  // ── Clean up stale notification data from previous sessions ─────────────
  // When the session expires or a new session starts, the storage key changes.
  // Old keys are no longer referenced. We opportunistically clean them up.
  useEffect(() => {
    if (!businessId || !servicePointId || !isLoaded) return

    const currentSid = getSessionInstanceId(servicePointId)
    const prefixes = [
      `qs_customer_notifications_${businessId}_${servicePointId}_`,
      `qs_customer_notification_events_${businessId}_${servicePointId}_`,
    ]

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        const prefix = key ? prefixes.find((candidate) => key.startsWith(candidate)) : null
        if (key && prefix) {
          // Keep only the key matching the current session instance
          if (currentSid && key === `${prefix}${currentSid}`) continue
          localStorage.removeItem(key)
        }
      }
    } catch {
      // localStorage iteration may fail in some environments — non-critical
    }
  }, [businessId, servicePointId, isLoaded])

  // Tracks recently-fired toast keys to prevent duplicate toasts for the same event
  const recentToastKeys = useRef<Set<string>>(new Set())

  const addNotification = useCallback((
    notif: Omit<CustomerNotification, "id" | "timestamp" | "isRead">,
    options?: { silent?: boolean; timestamp?: number }
  ) => {
    const newNotif: CustomerNotification = {
      ...notif,
      id: crypto.randomUUID(),
      timestamp: options?.timestamp ?? Date.now(),
      isRead: false,
    }
    setNotifications((prev) => {
      return [newNotif, ...prev]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_NOTIFICATIONS)
    })

    // Silent mode: add to notification center only (no sound/toast)
    if (options?.silent) return

    setHasNewPulse(true)
    playNotificationSound()
    setTimeout(() => setHasNewPulse(false), 2000)

    // 🍞 Toast ────────────────────────────────────────────────────────
    // Dedup key: uses the stable entity identity so two unrelated events
    // (e.g. two different waiter calls) never suppress one another.
    const entityId = getNotificationEntityId(notif.data)
    const dedupeKey = `${notif.type}|${notif.title}|${entityId}`
    if (!recentToastKeys.current.has(dedupeKey)) {
      recentToastKeys.current.add(dedupeKey)
      setTimeout(() => recentToastKeys.current.delete(dedupeKey), 8_000)

      const toastOpts = {
        description: notif.subtitle,
        duration: 5_000,
        icon: TOAST_ICON[notif.title] ?? (notif.type === "WAITER_CALL" ? "🛎️" : "🍽️"),
      }

      if (SUCCESS_TITLES.has(notif.title)) {
        toast.success(notif.title, toastOpts)
      } else {
        toast(notif.title, toastOpts)
      }
    }
    // 🍞 End Toast ────────────────────────────────────────────────────
  }, [])

  const persistProcessedCustomerEventIds = useCallback(() => {
    const storageKey = getProcessedEventsStorageKey()
    if (!storageKey) return
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(Array.from(processedCustomerEventIds.current)),
      )
    } catch (err) {
      console.error("Failed to save processed customer notification events", err)
    }
  }, [getProcessedEventsStorageKey])

  const claimOrderEvent = useCallback((eventId: string) => {
    const claimed = claimCustomerNotificationEvent(
      processedCustomerEventIds.current,
      eventId,
    )
    if (claimed) persistProcessedCustomerEventIds()
    return claimed
  }, [persistProcessedCustomerEventIds])

  const ingestWaitstaffCalls = useCallback((
    incoming: IncomingWaiterCall,
    source: WaitstaffNotificationSource,
  ) => {
    if (!businessId || !isTableSessionValid(servicePointId)) return

    const events = deriveWaitstaffAcknowledgementNotificationEvents(incoming, {
      businessId,
      servicePointId,
    })

    events.forEach((event) => {
      if (!claimOrderEvent(event.eventId)) return

      addNotification({
        type: "WAITER_CALL",
        title: "A Waitstaff is on the way",
        subtitle: `${event.call.acknowledgedByName || "A staff member"} is heading to you.`,
        data: {
          ...event.call,
          eventId: event.eventId,
          eventType: event.eventType,
          recovered: source === "recovery",
        },
      }, {
        silent: source !== "sse",
        timestamp: event.occurredAt,
      })
    })
  }, [addNotification, businessId, claimOrderEvent, servicePointId])

  const handleOrderEvent = (data: any, sourceEvent: "order_created" | "order_updated") => {
    const order = data?.order
    const action = data?.action
    const customerEvent = data?.customerNotification
    if (!order) return

    // Only process events for this service point.
    // Compare servicePointId directly — never compare a label against an id.
    if (order.servicePointId !== servicePointId) return

    // Match the ETA widget's ownership pattern. A newly-created order can be
    // identified by its device session before the confirmation page has had a
    // chance to persist the order ID; stored IDs remain the legacy fallback.
    const sid = ensureSessionId()
    let isOwnOrder = Boolean(sid && order.sessionId && order.sessionId === sid)

    if (!isOwnOrder) {
      const myOrdersKey = getMyOrdersKey()
      if (myOrdersKey) {
        try {
          const stored = localStorage.getItem(myOrdersKey)
          const myOrderIds: string[] = stored ? JSON.parse(stored) : []
          isOwnOrder = myOrderIds.includes(order.orderId)
        } catch {
          isOwnOrder = false
        }
      }
    }

    if (!isOwnOrder) return

    if (order.status === "completed" && !order.feedbackSubmitted) {
      setFeedbackOrder(order)
    }

    let eventId = ""
    let eventType = ""
    let title = ""
    let subtitle = ""

    if (action === "payment_confirmed") {
      eventId = `${order.orderId}:PAYMENT_CONFIRMED`
      eventType = "PAYMENT_CONFIRMED"
      title = "Payment Confirmed"
      subtitle = "Thank you for your patronage! Your payment has been received."
    } else if (customerEvent?.eventId && customerEvent?.title && customerEvent?.message) {
      eventId = String(customerEvent.eventId)
      eventType = String(customerEvent.eventType || "ORDER_UPDATE")
      title = String(customerEvent.title)
      subtitle = String(customerEvent.message)
    } else if (sourceEvent === "order_created") {
      eventId = `${order.orderId}:ORDER_PLACED`
      eventType = "ORDER_PLACED"
      const mapped = mapOrderStatusNotification("placed")
      if (!mapped) return
      title = mapped.title
      subtitle = mapped.subtitle
    } else if (action === "cancelled" || order.status === "cancelled") {
      eventId = `${order.orderId}:ORDER_CANCELLED`
      eventType = "ORDER_CANCELLED"
      const mapped = mapOrderStatusNotification("cancelled")
      if (!mapped) return
      title = mapped.title
      subtitle = mapped.subtitle
    } else {
      // Fulfilment updates must carry the authoritative transition event. A
      // global in_progress status alone is not enough to choose customer copy.
      return
    }

    if (!claimOrderEvent(eventId)) return

    const actionUrl = `/s/${servicePointId}/status?orderId=${order.orderId}&businessId=${businessId}&scope=current`

    addNotification({
      type: "ORDER_UPDATE",
      title,
      subtitle,
      data: { ...order, eventId, eventType },
      actionUrl,
    })
  }

  const token = getTableToken(servicePointId)
  const deviceSessionId = ensureSessionId()
  const sessionInstanceId = getSessionInstanceId(servicePointId)
  const reconciliationScopeKey = (
    businessId &&
    servicePointId &&
    isSessionValid &&
    token &&
    deviceSessionId &&
    sessionInstanceId
  )
    ? JSON.stringify([
        businessId,
        servicePointId,
        sessionInstanceId,
        deviceSessionId,
        token,
      ])
    : null

  // Invalidate the committed scope before an obsolete response can claim
  // event IDs, persist history, or emit a toast after navigation/unmount.
  useLayoutEffect(() => {
    const coordinator = recoveryCoordinator.current
    if (!coordinator || !reconciliationScopeKey) {
      coordinator?.deactivateScope()
      return
    }

    coordinator.activateScope(reconciliationScopeKey)
    return () => coordinator.deactivateScope(reconciliationScopeKey)
  }, [reconciliationScopeKey])

  const reconcileCustomerNotifications = useCallback((options?: {
    requireFreshAfterCurrent?: boolean
  }) => {
    if (!isLoaded || !reconciliationScopeKey || !token || !deviceSessionId) {
      return Promise.resolve()
    }

    const coordinator = recoveryCoordinator.current
    if (!coordinator) return Promise.resolve()

    return coordinator.run(
      reconciliationScopeKey,
      async () => {
        const response = await apiClient.get("/orders/current", {
          params: { businessId, sessionId: deviceSessionId },
          headers: { "x-table-session-token": token },
        })
        const orders = Array.isArray(response.data)
          ? response.data as CustomerNotificationOrder[]
          : []
        const myOrdersKey = getMyOrdersKey()
        let storedOrderIds = new Set<string>()
        if (myOrdersKey) {
          try {
            const stored = localStorage.getItem(myOrdersKey)
            const parsed = stored ? JSON.parse(stored) : []
            if (Array.isArray(parsed)) {
              storedOrderIds = new Set(parsed.filter((value): value is string => (
                typeof value === "string"
              )))
            }
          } catch {
            storedOrderIds = new Set()
          }
        }

        const context = {
          businessId,
          servicePointId,
          deviceSessionId,
          storedOrderIds,
        }
        return sortCustomerNotificationEvents(
          orders
            .filter((order) => isCustomerNotificationOrderInContext(order, context))
            .flatMap(deriveCustomerOrderNotificationEvents),
        )
      },
      (recoveredEvents) => {
        const missed = recoveredEvents.filter((customerEvent) => claimCustomerNotificationEvent(
          processedCustomerEventIds.current,
          customerEvent.eventId,
        ))

        if (missed.length === 0) return
        persistProcessedCustomerEventIds()

        // Recover every proven event into history, while surfacing only the
        // newest recovered event as a toast to avoid a reconnect toast storm.
        missed.forEach((customerEvent, index) => {
          const order = customerEvent.order
          addNotification({
            type: "ORDER_UPDATE",
            title: customerEvent.title,
            subtitle: customerEvent.message,
            data: {
              ...order,
              eventId: customerEvent.eventId,
              eventType: customerEvent.eventType,
              recovered: true,
            },
            actionUrl: `/s/${servicePointId}/status?orderId=${order.orderId}&businessId=${businessId}&scope=current`,
          }, {
            silent: index !== missed.length - 1,
            timestamp: customerEvent.occurredAt,
          })
        })
      },
      options,
    ).catch((err) => {
      console.error("[CustomerNotifications] Failed to reconcile current orders", err)
    })
  }, [
    addNotification,
    businessId,
    deviceSessionId,
    getMyOrdersKey,
    isLoaded,
    persistProcessedCustomerEventIds,
    reconciliationScopeKey,
    servicePointId,
    token,
  ])

  useEffect(() => {
    void reconcileCustomerNotifications()
  }, [reconcileCustomerNotifications])

  const handlers = {
    order_created: (data: any) => handleOrderEvent(data, "order_created"),
    order_updated: (data: any) => handleOrderEvent(data, "order_updated"),
    waiter_call_updated: (data: any) => {
      if (data?.call) ingestWaitstaffCalls(data.call, "sse")
    },
  }

  // Only open SSE when both businessId is known AND the table session is valid.
  // Passing "" to useEventSource prevents it from connecting at all.
  // SSE is the fast path. The same authorized current-order read used by the
  // ETA widget recovers lifecycle events missed during reconnect or suspension.
  const sseUrl = businessId && deviceSessionId && isSessionValid && token
    ? `/events?role=table&businessId=${encodeURIComponent(businessId)}&token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(deviceSessionId)}`
    : ""
  useEventSource(sseUrl, handlers, {
    onOpen: () => {
      void reconcileCustomerNotifications({ requireFreshAfterCurrent: true })
    },
    onReconnect: reconcileCustomerNotifications,
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return {
    notifications,
    unreadCount,
    hasNewPulse,
    isSessionValid,
    markAsRead,
    markAllAsRead,
    clearAll,
    ingestWaitstaffCalls,
    feedbackOrder,
    setFeedbackOrder
  }
}
