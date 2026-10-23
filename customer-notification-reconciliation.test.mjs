import assert from "node:assert/strict"
import test from "node:test"

import {
  claimCustomerNotificationEvent,
  createCustomerNotificationRecoveryCoordinator,
  deriveCustomerOrderNotificationEvents,
  isCustomerNotificationOrderInContext,
  sortCustomerNotificationEvents,
} from "./lib/customer-notification-reconciliation.ts"

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function currentOrder(overrides = {}) {
  return {
    orderId: "order_1",
    businessId: "business_1",
    servicePointId: "sp_1",
    sessionId: "device_1",
    status: "completed",
    createdAt: "2026-09-27T12:00:00.000Z",
    updatedAt: "2026-09-27T12:20:00.000Z",
    readyAt: "2026-09-27T12:10:00.000Z",
    completedAt: "2026-09-27T12:15:00.000Z",
    paidAt: "2026-09-27T12:00:05.000Z",
    paymentStatus: "paid",
    customerProgress: {
      stationContext: {
        food: {
          required: true,
          startedAt: "2026-09-27T12:01:00.000Z",
          readyAt: "2026-09-27T12:10:00.000Z",
        },
        drinks: {
          required: true,
          startedAt: "2026-09-27T12:02:00.000Z",
          readyAt: "2026-09-27T12:05:00.000Z",
        },
      },
    },
    ...overrides,
  }
}

test("reconstructs proven missed lifecycle events in canonical chronological order", () => {
  const events = deriveCustomerOrderNotificationEvents(currentOrder())

  assert.deepEqual(events.map((event) => event.eventType), [
    "ORDER_PLACED",
    "PAYMENT_CONFIRMED",
    "KITCHEN_STARTED",
    "BAR_STARTED",
    "BAR_READY",
    "ORDER_READY",
    "ORDER_SERVED",
  ])
  assert.deepEqual(
    events.map((event) => event.occurredAt),
    [...events.map((event) => event.occurredAt)].sort((a, b) => a - b),
  )
})

test("stable recovered identities match the live SSE event contract", () => {
  const events = deriveCustomerOrderNotificationEvents(currentOrder())

  assert.deepEqual(events.map((event) => event.eventId), [
    "order_1:ORDER_PLACED",
    "order_1:PAYMENT_CONFIRMED",
    "order_1:KITCHEN_STARTED",
    "order_1:BAR_STARTED",
    "order_1:BAR_READY",
    "order_1:ORDER_READY",
    "order_1:ORDER_SERVED",
  ])
})

test("does not infer preparation or readiness from generic status without timestamps", () => {
  const events = deriveCustomerOrderNotificationEvents(currentOrder({
    status: "ready",
    readyAt: null,
    completedAt: null,
    paidAt: null,
    paymentStatus: "unpaid",
    customerProgress: {
      stationContext: {
        food: { required: true, startedAt: null, readyAt: null },
        drinks: { required: false, startedAt: null, readyAt: null },
      },
    },
  }))

  assert.deepEqual(events.map((event) => event.eventType), ["ORDER_PLACED"])
})

test("station readiness is recovered only when it precedes whole-order readiness", () => {
  const events = deriveCustomerOrderNotificationEvents(currentOrder())

  assert.equal(events.some((event) => event.eventType === "BAR_READY"), true)
  assert.equal(events.some((event) => event.eventType === "KITCHEN_READY"), false)
  assert.equal(events.some((event) => event.eventType === "ORDER_READY"), true)
})

test("partial station readiness is recoverable before the whole order is ready", () => {
  const events = deriveCustomerOrderNotificationEvents(currentOrder({
    status: "in_progress",
    readyAt: null,
    completedAt: null,
    paymentStatus: "unpaid",
    paidAt: null,
  }))

  assert.equal(events.some((event) => event.eventType === "BAR_READY"), true)
  assert.equal(events.some((event) => event.eventType === "ORDER_READY"), false)
})

test("online payment confirmation comes only from canonical paid state and paidAt", () => {
  const confirmed = deriveCustomerOrderNotificationEvents(currentOrder({
    paymentChannel: "online",
    paymentStatus: "paid",
  }))
  const pending = deriveCustomerOrderNotificationEvents(currentOrder({
    paymentChannel: "online",
    paymentStatus: "pending",
  }))
  const missingTimestamp = deriveCustomerOrderNotificationEvents(currentOrder({
    paymentChannel: "online",
    paymentStatus: "paid",
    paidAt: null,
  }))

  assert.equal(confirmed.some((event) => event.eventType === "PAYMENT_CONFIRMED"), true)
  assert.equal(pending.some((event) => event.eventType === "PAYMENT_CONFIRMED"), false)
  assert.equal(missingTimestamp.some((event) => event.eventType === "PAYMENT_CONFIRMED"), false)
})

test("redirect or success URL data cannot manufacture payment confirmation", () => {
  const events = deriveCustomerOrderNotificationEvents(currentOrder({
    paymentStatus: "pending",
    paidAt: null,
    success: true,
    stripeSessionId: "cs_untrusted_redirect_value",
  }))

  assert.equal(events.some((event) => event.eventType === "PAYMENT_CONFIRMED"), false)
})

test("offline payment uses the same stable payment identity as live delivery", () => {
  const events = deriveCustomerOrderNotificationEvents(currentOrder({
    paymentChannel: "offline",
  }))
  const payment = events.find((event) => event.eventType === "PAYMENT_CONFIRMED")

  assert.equal(payment?.eventId, "order_1:PAYMENT_CONFIRMED")
})

test("completed recovery requires its timestamp and cancellation is not timestamp-inferred", () => {
  const completed = deriveCustomerOrderNotificationEvents(currentOrder())
  const cancelled = deriveCustomerOrderNotificationEvents(currentOrder({
    status: "cancelled",
    completedAt: null,
  }))

  assert.equal(completed.some((event) => event.eventType === "ORDER_SERVED"), true)
  assert.equal(cancelled.some((event) => event.eventType === "ORDER_CANCELLED"), false)
  assert.equal(cancelled.some((event) => event.eventType === "ORDER_SERVED"), false)
})

test("authorized context rejects another business, ServicePoint, or device", () => {
  const context = {
    businessId: "business_1",
    servicePointId: "sp_1",
    deviceSessionId: "device_1",
    storedOrderIds: new Set(),
  }

  assert.equal(isCustomerNotificationOrderInContext(currentOrder(), context), true)
  assert.equal(isCustomerNotificationOrderInContext(currentOrder({ businessId: "business_2" }), context), false)
  assert.equal(isCustomerNotificationOrderInContext(currentOrder({ servicePointId: "sp_2" }), context), false)
  assert.equal(isCustomerNotificationOrderInContext(currentOrder({ sessionId: "device_2" }), context), false)
})

test("session-scoped stored order IDs remain the legacy ownership fallback", () => {
  const order = currentOrder({ sessionId: null })
  const baseContext = {
    businessId: "business_1",
    servicePointId: "sp_1",
    deviceSessionId: "device_1",
  }

  assert.equal(isCustomerNotificationOrderInContext(order, {
    ...baseContext,
    storedOrderIds: new Set(["order_1"]),
  }), true)
  assert.equal(isCustomerNotificationOrderInContext(order, {
    ...baseContext,
    storedOrderIds: new Set(),
  }), false)
})

test("live SSE followed by reconciliation claims one logical event", () => {
  const processed = new Set()
  const ready = deriveCustomerOrderNotificationEvents(currentOrder())
    .find((event) => event.eventType === "ORDER_READY")

  assert.equal(claimCustomerNotificationEvent(processed, ready.eventId), true)
  assert.equal(claimCustomerNotificationEvent(processed, ready.eventId), false)
  assert.equal(processed.size, 1)
})

test("repeated reconnect and visibility reconciliation remain idempotent", () => {
  const processed = new Set()
  const events = deriveCustomerOrderNotificationEvents(currentOrder())
  const first = events.filter((event) => claimCustomerNotificationEvent(processed, event.eventId))
  const reconnect = events.filter((event) => claimCustomerNotificationEvent(processed, event.eventId))
  const visible = events.filter((event) => claimCustomerNotificationEvent(processed, event.eventId))

  assert.equal(first.length, events.length)
  assert.equal(reconnect.length, 0)
  assert.equal(visible.length, 0)
})

test("events from multiple orders are globally ordered by canonical occurrence", () => {
  const events = sortCustomerNotificationEvents([
    ...deriveCustomerOrderNotificationEvents(currentOrder({
      orderId: "order_later",
      createdAt: "2026-09-27T13:00:00.000Z",
    })),
    ...deriveCustomerOrderNotificationEvents(currentOrder({
      orderId: "order_earlier",
    })),
  ])

  assert.equal(events[0].eventId, "order_earlier:ORDER_PLACED")
  assert.equal(events.at(-1).order.orderId, "order_later")
})

test("first SSE open queues one fresh authoritative read after an in-flight initial snapshot", async () => {
  const coordinator = createCustomerNotificationRecoveryCoordinator()
  const initialResponse = deferred()
  const scope = "business_1|sp_1|visit_a|device_1"
  const processed = new Set()
  const history = []
  const readyEvent = { eventId: "order_1:ORDER_READY" }
  let loadCount = 0

  coordinator.activateScope(scope)
  const apply = (events) => {
    events.forEach((event) => {
      if (claimCustomerNotificationEvent(processed, event.eventId)) {
        history.push(event.eventId)
      }
    })
  }
  const initial = coordinator.run(scope, async () => {
    loadCount += 1
    return initialResponse.promise
  }, apply)
  const firstOpen = coordinator.run(scope, async () => {
    loadCount += 1
    return [readyEvent]
  }, apply, { requireFreshAfterCurrent: true })
  const duplicateFirstOpen = coordinator.run(scope, async () => {
    loadCount += 1
    return [readyEvent]
  }, apply, { requireFreshAfterCurrent: true })

  assert.equal(loadCount, 1)
  assert.equal(firstOpen, duplicateFirstOpen)
  initialResponse.resolve([])
  await Promise.all([initial, firstOpen, duplicateFirstOpen])

  assert.equal(loadCount, 2)
  assert.deepEqual(history, ["order_1:ORDER_READY"])
})

test("live SSE around first-open recovery and an already-processed initial event remain deduplicated", async () => {
  const coordinator = createCustomerNotificationRecoveryCoordinator()
  const scope = "business_1|sp_1|visit_a|device_1"
  const processed = new Set()
  const history = []
  const response = deferred()
  const readyEvent = { eventId: "order_1:ORDER_READY" }

  coordinator.activateScope(scope)
  const recovery = coordinator.run(scope, () => response.promise, (events) => {
    events.forEach((event) => {
      if (claimCustomerNotificationEvent(processed, event.eventId)) {
        history.push(`recovered:${event.eventId}`)
      }
    })
  }, { requireFreshAfterCurrent: true })

  if (claimCustomerNotificationEvent(processed, readyEvent.eventId)) {
    history.push(`live:${readyEvent.eventId}`)
  }
  response.resolve([readyEvent])
  await recovery

  await coordinator.run(scope, async () => [readyEvent], (events) => {
    events.forEach((event) => {
      if (claimCustomerNotificationEvent(processed, event.eventId)) {
        history.push(`first-open:${event.eventId}`)
      }
    })
  }, { requireFreshAfterCurrent: true })

  assert.deepEqual(history, ["live:order_1:ORDER_READY"])
  assert.equal(processed.size, 1)
})

test("failed first-open recovery clears in-flight state so reconnect can retry", async () => {
  const coordinator = createCustomerNotificationRecoveryCoordinator()
  const scope = "business_1|sp_1|visit_a|device_1"
  const applied = []
  let loadCount = 0

  coordinator.activateScope(scope)
  await assert.rejects(coordinator.run(scope, async () => {
    loadCount += 1
    throw new Error("temporary failure")
  }, () => {
    applied.push("unexpected")
  }, { requireFreshAfterCurrent: true }))

  await coordinator.run(scope, async () => {
    loadCount += 1
    return ["recovered"]
  }, (events) => {
    applied.push(...events)
  })

  assert.equal(loadCount, 2)
  assert.deepEqual(applied, ["recovered"])
})

test("unmount discards an in-flight response before history, persistence, toast, or sound effects", async () => {
  const coordinator = createCustomerNotificationRecoveryCoordinator()
  const response = deferred()
  const scope = "business_1|sp_1|visit_a|device_1"
  const effects = { history: 0, persisted: 0, toast: 0, sound: 0 }

  coordinator.activateScope(scope)
  const recovery = coordinator.run(scope, () => response.promise, () => {
    effects.history += 1
    effects.persisted += 1
    effects.toast += 1
    effects.sound += 1
  })
  coordinator.deactivateScope(scope)
  response.resolve(["stale"])
  await recovery

  assert.deepEqual(effects, { history: 0, persisted: 0, toast: 0, sound: 0 })
})

test("Visit A response is discarded after scope change while Visit B reconciles normally", async () => {
  const coordinator = createCustomerNotificationRecoveryCoordinator()
  const visitAResponse = deferred()
  const applied = []
  const visitA = "business_1|sp_1|visit_a|device_1"
  const visitB = "business_1|sp_2|visit_b|device_1"

  coordinator.activateScope(visitA)
  const recoveryA = coordinator.run(visitA, () => visitAResponse.promise, (result) => {
    applied.push(result)
  })

  coordinator.activateScope(visitB)
  await coordinator.run(visitB, async () => "visit-b", (result) => {
    applied.push(result)
  })
  visitAResponse.resolve("visit-a")
  await recoveryA

  assert.deepEqual(applied, ["visit-b"])
})
