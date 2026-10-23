export type WaiterCallStatus =
  | "pending"
  | "acknowledged"
  | "resolved"
  | "missed"

export type ServiceRequest = {
  _id: string
  businessId: string
  servicePointId: string
  displayLabel?: string
  servicePointLabel?: string
  servicePointQrCode?: string
  reason?: string
  requestCategory?: string
  note?: string
  status: WaiterCallStatus
  claimedBy?: string | null
  claimedByName?: string
  acknowledgedByName?: string | null
  claimedAt?: string | null
  acknowledgedAt?: string | null
  resolvedBy?: string | null
  resolvedByName?: string | null
  resolvedAt?: string | null
  createdAt: string
  updatedAt?: string
  pendingExpiresAt?: string | null
  acknowledgedExpiresAt?: string | null
  missedAt?: string | null
}

export type WaiterRequestContext = {
  businessId: string
  servicePointId: string
}

export type IncomingWaiterCall =
  | ServiceRequest
  | ServiceRequest[]
  | null

export type WaitstaffRequestUpdateSource =
  | "recovery"
  | "sse"
  | "submit"

const statusRank: Record<WaiterCallStatus, number> = {
  pending: 0,
  acknowledged: 1,
  resolved: 2,
  missed: 2,
}

function normalizeIdentity(value: unknown) {
  return String(value || "").trim()
}

export function isServiceRequestForContext(
  call: ServiceRequest,
  context: WaiterRequestContext,
) {
  return (
    normalizeIdentity(call.businessId) ===
      normalizeIdentity(context.businessId) &&
    normalizeIdentity(call.servicePointId) ===
      normalizeIdentity(context.servicePointId)
  )
}

function isSameRequest(
  left: ServiceRequest,
  right: ServiceRequest,
) {
  return (
    left._id === right._id &&
    left.businessId === right.businessId &&
    left.servicePointId === right.servicePointId
  )
}

export function getLiveAcknowledgementTransitionKey(
  previousCall: ServiceRequest | null,
  nextCall: ServiceRequest | null,
  context: WaiterRequestContext,
  source: WaitstaffRequestUpdateSource,
) {
  if (source !== "sse" || !previousCall || !nextCall) return null
  if (
    !isServiceRequestForContext(previousCall, context) ||
    !isServiceRequestForContext(nextCall, context) ||
    !isSameRequest(previousCall, nextCall) ||
    previousCall.status !== "pending" ||
    nextCall.status !== "acknowledged"
  ) {
    return null
  }

  return `${nextCall._id}:${nextCall.acknowledgedAt || nextCall.updatedAt || nextCall.claimedAt || "acknowledged"}`
}

function isSameVersion(current: ServiceRequest, incoming: ServiceRequest) {
  return (
    isSameRequest(current, incoming) &&
    current.status === incoming.status &&
    current.updatedAt === incoming.updatedAt &&
    current.pendingExpiresAt === incoming.pendingExpiresAt &&
    current.acknowledgedExpiresAt === incoming.acknowledgedExpiresAt &&
    current.claimedBy === incoming.claimedBy &&
    current.resolvedAt === incoming.resolvedAt
  )
}

function isActive(call: ServiceRequest, now: number) {
  if (call.status === "acknowledged") {
    if (!call.acknowledgedExpiresAt) return false
    return new Date(call.acknowledgedExpiresAt).getTime() > now
  }
  if (call.status !== "pending") return false
  if (!call.pendingExpiresAt) return true
  return new Date(call.pendingExpiresAt).getTime() > now
}

function timestamp(value?: string | null) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function reconcileOne(
  existingCall: ServiceRequest | null,
  incomingCall: ServiceRequest,
  context: WaiterRequestContext,
) {
  if (!isServiceRequestForContext(incomingCall, context)) return existingCall
  if (!existingCall || !isServiceRequestForContext(existingCall, context)) {
    return incomingCall
  }

  if (!isSameRequest(existingCall, incomingCall)) {
    if (isActive(existingCall, Date.now()) && !isActive(incomingCall, Date.now())) {
      return existingCall
    }
    return timestamp(incomingCall.createdAt) > timestamp(existingCall.createdAt)
      ? incomingCall
      : existingCall
  }

  if (isSameVersion(existingCall, incomingCall)) return existingCall

  const existingUpdatedAt = timestamp(existingCall.updatedAt)
  const incomingUpdatedAt = timestamp(incomingCall.updatedAt)
  if (
    existingUpdatedAt &&
    incomingUpdatedAt &&
    incomingUpdatedAt < existingUpdatedAt
  ) {
    return existingCall
  }

  const reconciled = {
    ...existingCall,
    ...incomingCall,
    createdAt: existingCall.createdAt || incomingCall.createdAt,
    pendingExpiresAt: incomingCall.status === "acknowledged"
      ? null
      : existingCall.pendingExpiresAt || incomingCall.pendingExpiresAt || null,
  }

  // A late POST/create event cannot regress an acknowledgement or terminal update.
  if (statusRank[incomingCall.status] < statusRank[existingCall.status]) {
    reconciled.status = existingCall.status
  }

  return reconciled
}

/**
 * The only active waitstaff-request reconciliation strategy.
 *
 * A null/empty refresh preserves confirmed state. A fetched terminal record for
 * the same canonical request is authoritative and is merged into that request.
 */
export function reconcileIncomingCall(
  existingCall: ServiceRequest | null,
  incoming: IncomingWaiterCall,
  context: WaiterRequestContext,
  now = Date.now(),
): ServiceRequest | null {
  if (Array.isArray(incoming)) {
    const scopedExistingCall =
      existingCall && isServiceRequestForContext(existingCall, context)
        ? existingCall
        : null
    const scopedCalls = incoming.filter((call) =>
      isServiceRequestForContext(call, context),
    )

    if (scopedExistingCall) {
      const sameRequest = scopedCalls.find((call) =>
        isSameRequest(scopedExistingCall, call),
      )
      if (sameRequest) {
        return reconcileOne(scopedExistingCall, sameRequest, context)
      }
    }

    const latestActive = scopedCalls
      .filter((call) => isActive(call, now))
      .sort(
        (a, b) => timestamp(b.createdAt) - timestamp(a.createdAt),
      )[0]

    if (latestActive) {
      return reconcileOne(scopedExistingCall, latestActive, context)
    }
    if (
      scopedExistingCall?.status === "acknowledged" &&
      !isActive(scopedExistingCall, now)
    ) {
      return null
    }
    return scopedExistingCall
  }

  const scopedExistingCall =
    existingCall && isServiceRequestForContext(existingCall, context)
      ? existingCall
      : null
  return incoming
    ? reconcileOne(scopedExistingCall, incoming, context)
    : scopedExistingCall
}

export function getWaiterRequestTimerDeadline(call: ServiceRequest | null) {
  if (call?.status === "pending") return call.pendingExpiresAt || null
  if (call?.status === "acknowledged") {
    return call.acknowledgedExpiresAt || null
  }
  return null
}

export function getWaiterRequestTimerStart(call: ServiceRequest | null) {
  if (call?.status === "pending") return call.createdAt || null
  if (call?.status === "acknowledged") {
    return call.acknowledgedAt || call.claimedAt || call.updatedAt || null
  }
  return null
}
