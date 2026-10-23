const HIDDEN_ORDER_HISTORY_KEY = "hidden_orders_history"
const CLEARED_ORDER_HISTORY_KEY = "cleared_order_history"
const HISTORICAL_ORDER_STATUSES = new Set(["completed", "cancelled"])

type OrderHistoryEntry = {
  orderId: string
  status: string
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

type ClearedHistoryContext = {
  businessId: string
  sessionId: string
}

type ClearedHistoryRecord = ClearedHistoryContext & {
  clearedAt: string
}

export function getHistoricalOrderIds(orders: OrderHistoryEntry[]): string[] {
  return orders
    .filter((order) => HISTORICAL_ORDER_STATUSES.has(order.status))
    .map((order) => order.orderId)
}

export function getHiddenOrderIds(): string[] {
  if (typeof window === "undefined") return []

  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_ORDER_HISTORY_KEY) || "[]")
    return Array.isArray(parsed)
      ? parsed.filter((orderId): orderId is string => typeof orderId === "string" && orderId.length > 0)
      : []
  } catch {
    return []
  }
}

export function hideOrderIds(orderIds: string[]): string[] {
  if (typeof window === "undefined") return []

  const nextHiddenOrderIds = Array.from(
    new Set([
      ...getHiddenOrderIds(),
      ...orderIds.filter((orderId) => typeof orderId === "string" && orderId.length > 0),
    ]),
  )
  localStorage.setItem(HIDDEN_ORDER_HISTORY_KEY, JSON.stringify(nextHiddenOrderIds))
  return nextHiddenOrderIds
}

function readClearedHistory(): ClearedHistoryRecord[] {
  if (typeof window === "undefined") return []

  try {
    const parsed = JSON.parse(localStorage.getItem(CLEARED_ORDER_HISTORY_KEY) || "[]")
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is ClearedHistoryRecord => (
        entry &&
        typeof entry.businessId === "string" &&
        typeof entry.sessionId === "string" &&
        typeof entry.clearedAt === "string" &&
        Number.isFinite(Date.parse(entry.clearedAt))
      ))
      : []
  } catch {
    return []
  }
}

/**
 * A clear action is local presentation state, not deletion. The timestamp lets
 * a device hide older terminal orders that have not been fetched yet while a
 * live order completed after the action can still appear normally.
 */
export function clearOrderHistory(context: ClearedHistoryContext, clearedAt = new Date()): void {
  if (typeof window === "undefined") return

  const record: ClearedHistoryRecord = {
    ...context,
    clearedAt: clearedAt.toISOString(),
  }
  const retained = readClearedHistory().filter((entry) => (
    entry.businessId !== context.businessId || entry.sessionId !== context.sessionId
  ))
  localStorage.setItem(CLEARED_ORDER_HISTORY_KEY, JSON.stringify([...retained, record]))
}

function clearedAtFor(context: ClearedHistoryContext): Date | null {
  const record = readClearedHistory().find((entry) => (
    entry.businessId === context.businessId && entry.sessionId === context.sessionId
  ))
  return record ? new Date(record.clearedAt) : null
}

export function isOrderHiddenFromHistory(
  order: OrderHistoryEntry,
  context: ClearedHistoryContext,
  hiddenOrderIds = getHiddenOrderIds(),
): boolean {
  if (hiddenOrderIds.includes(order.orderId)) return true
  if (!HISTORICAL_ORDER_STATUSES.has(order.status)) return false

  const clearedAt = clearedAtFor(context)
  if (!clearedAt) return false

  const terminalAt = new Date(order.updatedAt || order.createdAt || 0)
  return Number.isFinite(terminalAt.getTime()) && terminalAt.getTime() <= clearedAt.getTime()
}
