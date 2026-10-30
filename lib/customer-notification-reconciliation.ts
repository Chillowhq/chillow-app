export type CustomerNotificationStationState = {
  required?: boolean
  startedAt?: string | null
  readyAt?: string | null
}

export type CustomerNotificationOrder = {
  orderId: string
  businessId?: string | null
  servicePointId?: string | null
  sessionId?: string | null
  status?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  readyAt?: string | null
  completedAt?: string | null
  paidAt?: string | null
  paymentStatus?: string | null
  feedbackSubmitted?: boolean
  customerProgress?: {
    stationContext?: {
      food?: CustomerNotificationStationState | null
      drinks?: CustomerNotificationStationState | null
    } | null
  } | null
}

export type ReconciledCustomerOrderEvent = {
  eventId: string
  eventType: string
  title: string
  message: string
  occurredAt: number
  order: CustomerNotificationOrder
}

export type CustomerNotificationContext = {
  businessId: string
  servicePointId: string
  deviceSessionId: string
  storedOrderIds?: ReadonlySet<string>
}

type EventCopy = {
  title: string
  message: string
  priority: number
}

const EVENT_COPY: Record<string, EventCopy> = {
  ORDER_PLACED: {
    title: "Order placed",
    message: "We have received your order.",
    priority: 10,
  },
  KITCHEN_STARTED: {
    title: "Food is being prepared",
    message: "We've started preparing your food.",
    priority: 20,
  },
  BAR_STARTED: {
    title: "Drinks are being prepared",
    message: "We've started preparing your drinks.",
    priority: 21,
  },
  KITCHEN_READY: {
    title: "Food ready",
    message: "Your food is ready.",
    priority: 30,
  },
  BAR_READY: {
    title: "Drinks ready",
    message: "Your drinks are ready.",
    priority: 31,
  },
  ORDER_READY: {
    title: "Order ready!",
    message: "Your order is ready to be served.",
    priority: 40,
  },
  PAYMENT_CONFIRMED: {
    title: "Payment Confirmed",
    message: "Thank you for your patronage! Your payment has been received.",
    priority: 50,
  },
  ORDER_SERVED: {
    title: "Order completed",
    message: "Enjoy!!",
    priority: 60,
  },
}

function timestamp(value?: string | null) {
  const parsed = Date.parse(value || "")
  return Number.isFinite(parsed) ? parsed : null
}

function event(
  order: CustomerNotificationOrder,
  eventType: keyof typeof EVENT_COPY,
  occurredAt: number | null,
): ReconciledCustomerOrderEvent | null {
  if (!occurredAt || !order.orderId) return null
  const copy = EVENT_COPY[eventType]
  return {
    eventId: `${order.orderId}:${eventType}`,
    eventType,
    title: copy.title,
    message: copy.message,
    occurredAt,
    order,
  }
}

/**
 * Defense-in-depth for the already visit-scoped /orders/current response.
 * The backend remains authoritative; this prevents an unexpected DTO from
 * crossing the active business, ServicePoint, or device boundary in the UI.
 */
export function isCustomerNotificationOrderInContext(
  order: CustomerNotificationOrder,
  context: CustomerNotificationContext,
) {
  if (!order?.orderId) return false
  if (order.businessId && order.businessId !== context.businessId) return false
  if (order.servicePointId !== context.servicePointId) return false
  if (order.sessionId && order.sessionId === context.deviceSessionId) return true
  return context.storedOrderIds?.has(order.orderId) === true
}

/**
 * Reconstructs only lifecycle events proven by canonical persisted timestamps.
 * Event identities intentionally match the live SSE contract.
 */
export function deriveCustomerOrderNotificationEvents(
  order: CustomerNotificationOrder,
): ReconciledCustomerOrderEvent[] {
  if (!order?.orderId) return []

  const events: ReconciledCustomerOrderEvent[] = []
  const push = (candidate: ReconciledCustomerOrderEvent | null) => {
    if (candidate) events.push(candidate)
  }

  push(event(order, "ORDER_PLACED", timestamp(order.createdAt)))

  const food = order.customerProgress?.stationContext?.food
  const drinks = order.customerProgress?.stationContext?.drinks
  const foodStartedAt = timestamp(food?.startedAt)
  const drinksStartedAt = timestamp(drinks?.startedAt)
  const foodReadyAt = timestamp(food?.readyAt)
  const drinksReadyAt = timestamp(drinks?.readyAt)
  const orderReadyAt = timestamp(order.readyAt)

  push(event(order, "KITCHEN_STARTED", foodStartedAt))
  push(event(order, "BAR_STARTED", drinksStartedAt))

  // The station that makes the whole order ready emits ORDER_READY live, not
  // an additional station-ready event. Equal timestamps are ambiguous, so we
  // avoid inventing a station event that canonical state cannot prove.
  if (foodReadyAt && (!orderReadyAt || foodReadyAt < orderReadyAt)) {
    push(event(order, "KITCHEN_READY", foodReadyAt))
  }
  if (drinksReadyAt && (!orderReadyAt || drinksReadyAt < orderReadyAt)) {
    push(event(order, "BAR_READY", drinksReadyAt))
  }
  push(event(order, "ORDER_READY", orderReadyAt))

  if (order.paymentStatus === "paid") {
    push(event(order, "PAYMENT_CONFIRMED", timestamp(order.paidAt)))
  }
  if (order.status === "completed") {
    push(event(order, "ORDER_SERVED", timestamp(order.completedAt)))
  }
  return events.sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt - b.occurredAt
    return EVENT_COPY[a.eventType].priority - EVENT_COPY[b.eventType].priority
  })
}

export function sortCustomerNotificationEvents(
  events: ReconciledCustomerOrderEvent[],
) {
  return [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt - b.occurredAt
    return EVENT_COPY[a.eventType].priority - EVENT_COPY[b.eventType].priority
  })
}

/** Synchronous claiming makes live SSE and reconciliation race-idempotent. */
export function claimCustomerNotificationEvent(
  processedEventIds: Set<string>,
  eventId: string,
) {
  if (!eventId || processedEventIds.has(eventId)) return false
  processedEventIds.add(eventId)
  return true
}

export type CustomerNotificationRecoveryRunOptions = {
  /** Queue one new read after the current same-scope read settles. */
  requireFreshAfterCurrent?: boolean
}

export type CustomerNotificationRecoveryCoordinator = {
  activateScope: (scopeKey: string) => void
  deactivateScope: (scopeKey?: string) => void
  run: <T>(
    scopeKey: string,
    load: () => Promise<T>,
    apply: (result: T) => void | Promise<void>,
    options?: CustomerNotificationRecoveryRunOptions,
  ) => Promise<void>
}

/**
 * Coordinates authoritative recovery reads for one mounted notification hook.
 * Same-scope triggers coalesce, except first-open recovery can request exactly
 * one trailing read to close the initial snapshot/SSE subscription gap.
 * Results are applied only while their originating scope is still active.
 */
export function createCustomerNotificationRecoveryCoordinator(
): CustomerNotificationRecoveryCoordinator {
  let activeScopeKey: string | null = null
  let isMounted = false
  let inFlight: { scopeKey: string; promise: Promise<void> } | null = null
  let queuedFresh: { scopeKey: string; promise: Promise<void> } | null = null

  const isCurrent = (scopeKey: string) => (
    isMounted && activeScopeKey === scopeKey
  )

  const start = <T>(
    scopeKey: string,
    load: () => Promise<T>,
    apply: (result: T) => void | Promise<void>,
  ) => {
    const promise = (async () => {
      const result = await load()
      if (!isCurrent(scopeKey)) return
      await apply(result)
    })().finally(() => {
      if (inFlight?.promise === promise) {
        inFlight = null
      }
    })
    inFlight = { scopeKey, promise }
    return promise
  }

  return {
    activateScope(scopeKey) {
      isMounted = true
      activeScopeKey = scopeKey
    },

    deactivateScope(scopeKey) {
      if (scopeKey && activeScopeKey !== scopeKey) return
      isMounted = false
      activeScopeKey = null
    },

    run(scopeKey, load, apply, options) {
      if (!isCurrent(scopeKey)) return Promise.resolve()

      const current = inFlight
      if (!current || current.scopeKey !== scopeKey) {
        return start(scopeKey, load, apply)
      }

      if (!options?.requireFreshAfterCurrent) {
        return current.promise
      }

      if (queuedFresh?.scopeKey === scopeKey) {
        return queuedFresh.promise
      }

      const queuedPromise = current.promise
        .catch(() => undefined)
        .then(() => {
          if (!isCurrent(scopeKey)) return
          return start(scopeKey, load, apply)
        })
        .finally(() => {
          if (queuedFresh?.promise === queuedPromise) {
            queuedFresh = null
          }
        })
      queuedFresh = { scopeKey, promise: queuedPromise }
      return queuedPromise
    },
  }
}
