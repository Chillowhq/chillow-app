import { beforeEach, describe, expect, it } from "vitest"

import {
  clearOrderHistory,
  hideOrderIds,
  isOrderHiddenFromHistory,
} from "./order-history-storage"

const context = { businessId: "business-a", sessionId: "device-a" }

describe("guest order-history local visibility", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("keeps individually hidden orders hidden", () => {
    hideOrderIds(["order-1"])

    expect(isOrderHiddenFromHistory({ orderId: "order-1", status: "completed" }, context)).toBe(true)
  })

  it("hides terminal orders from pages that were not downloaded before Clear All", () => {
    clearOrderHistory(context, new Date("2026-01-10T12:00:00.000Z"))

    expect(isOrderHiddenFromHistory({
      orderId: "older-order",
      status: "completed",
      createdAt: "2026-01-01T12:00:00.000Z",
      updatedAt: "2026-01-03T12:00:00.000Z",
    }, context)).toBe(true)
  })

  it("does not hide a live order that becomes terminal after Clear All", () => {
    clearOrderHistory(context, new Date("2026-01-10T12:00:00.000Z"))

    expect(isOrderHiddenFromHistory({
      orderId: "newly-completed-order",
      status: "completed",
      createdAt: "2026-01-01T12:00:00.000Z",
      updatedAt: "2026-01-11T12:00:00.000Z",
    }, context)).toBe(false)
  })

  it("keeps clear-history state isolated by business and device", () => {
    clearOrderHistory(context, new Date("2026-01-10T12:00:00.000Z"))
    const historicalOrder = {
      orderId: "order-1",
      status: "cancelled",
      updatedAt: "2026-01-01T12:00:00.000Z",
    }

    expect(isOrderHiddenFromHistory(historicalOrder, { businessId: "business-b", sessionId: "device-a" })).toBe(false)
    expect(isOrderHiddenFromHistory(historicalOrder, { businessId: "business-a", sessionId: "device-b" })).toBe(false)
  })
})
