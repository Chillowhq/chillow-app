import {
  isServiceRequestForContext,
  type IncomingWaiterCall,
  type ServiceRequest,
  type WaiterRequestContext,
} from "@/lib/waitstaff-request-reconciliation"

export type WaitstaffNotificationSource = "sse" | "recovery"

export type WaitstaffAcknowledgementNotificationEvent = {
  eventId: string
  eventType: "WAITER_ACKNOWLEDGED"
  occurredAt: number
  call: ServiceRequest
}

function timestamp(value?: string | null) {
  const parsed = Date.parse(value || "")
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Derives only acknowledgement events that canonical persisted waiter-call
 * state can prove. Request ownership is enforced by the backend recovery DTO
 * and by the table SSE authorization layer before calls reach this helper.
 */
export function deriveWaitstaffAcknowledgementNotificationEvents(
  incoming: IncomingWaiterCall,
  context: WaiterRequestContext,
): WaitstaffAcknowledgementNotificationEvent[] {
  const calls = Array.isArray(incoming)
    ? incoming
    : incoming
      ? [incoming]
      : []

  return calls.flatMap((call) => {
    if (
      !isServiceRequestForContext(call, context) ||
      call.status !== "acknowledged"
    ) {
      return []
    }

    const occurredAt = timestamp(call.acknowledgedAt)
    if (!occurredAt) return []

    return [{
      eventId: `${call._id}:WAITER_ACKNOWLEDGED:${call.acknowledgedAt}`,
      eventType: "WAITER_ACKNOWLEDGED" as const,
      occurredAt,
      call,
    }]
  }).sort((left, right) => left.occurredAt - right.occurredAt)
}
