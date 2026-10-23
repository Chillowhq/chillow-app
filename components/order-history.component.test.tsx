import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { HTMLAttributes, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

type MotionDivProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  drag?: unknown
  dragConstraints?: unknown
  dragElastic?: unknown
  whileTap?: unknown
}

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  push: vi.fn(),
  orderUpdated: null as ((data: unknown) => void) | null,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock("@/lib/axios-config", () => ({
  apiClient: { get: mocks.get },
}))

vi.mock("@/lib/business-info", () => ({
  getBusinessId: () => "business-a",
}))

vi.mock("@/lib/guest-session", () => ({
  ensureSessionId: () => "device-a",
  getTableToken: () => null,
  isTableSessionValid: () => false,
}))

vi.mock("@/hooks/use-event-source", () => ({
  useEventSource: (_url: string, handlers: { order_updated?: (data: unknown) => void }) => {
    mocks.orderUpdated = handlers.order_updated || null
  },
}))

vi.mock("@/components/customer-loading-skeletons", () => ({
  OrderHistorySkeleton: () => <div>Loading order history</div>,
}))

vi.mock("./order-timer", () => ({
  OrderTimer: () => <span>Order time</span>,
}))

vi.mock("@/components/order-again-button", () => ({
  default: () => <button type="button">Order Again</button>,
}))

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: MotionDivProps) => {
      const domProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !["drag", "dragConstraints", "dragElastic", "whileTap"].includes(key)),
      ) as HTMLAttributes<HTMLDivElement>
      return <div {...domProps}>{children}</div>
    },
  },
}))

import OrderHistory from "./order-history"

function order(index: number) {
  return {
    orderId: `order-${index}`,
    businessId: "business-a",
    status: "completed",
    createdAt: `2026-01-01T00:${String(index).padStart(2, "0")}:00.000Z`,
    updatedAt: `2026-01-01T00:${String(index).padStart(2, "0")}:00.000Z`,
    total: 10,
    currency: "EUR",
    items: [{ itemName: `Item ${index}`, quantity: 1 }],
  }
}

function page(orders: ReturnType<typeof order>[], hasMore: boolean, nextCursor: string | null) {
  return { data: { orders, hasMore, nextCursor } }
}

afterEach(() => {
  cleanup()
  mocks.get.mockReset()
  mocks.push.mockReset()
  mocks.orderUpdated = null
})

describe("OrderHistory cursor pagination", () => {
  it("appends a following page without duplicates", async () => {
    mocks.get
      .mockResolvedValueOnce(page([order(1)], true, "cursor-1"))
      .mockResolvedValueOnce(page([order(2)], false, null))

    render(<OrderHistory servicePointId="sp-a" />)

    await screen.findByText("order-1")
    expect(mocks.get).toHaveBeenCalledWith("/orders/history", expect.objectContaining({
      params: { businessId: "business-a", sessionId: "device-a" },
    }))

    fireEvent.click(screen.getByRole("button", { name: "Load More Orders" }))
    await screen.findByText("order-2")

    expect(mocks.get).toHaveBeenLastCalledWith("/orders/history", expect.objectContaining({
      params: { businessId: "business-a", sessionId: "device-a", cursor: "cursor-1" },
    }))
    expect(screen.getAllByText("order-1")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Load More Orders" })).toBeNull()
  })

  it("keeps a page boundary failure retryable without losing loaded orders", async () => {
    const user = userEvent.setup()
    mocks.get
      .mockResolvedValueOnce(page([order(1)], true, "cursor-1"))
      .mockRejectedValueOnce({ response: { data: { message: "Could not load more" } } })
      .mockResolvedValueOnce(page([order(2)], false, null))

    render(<OrderHistory servicePointId="sp-a" />)
    await screen.findByText("order-1")

    await user.click(screen.getByRole("button", { name: "Load More Orders" }))
    await screen.findByText("Could not load more")
    expect(screen.getByText("order-1")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Retry" }))
    await screen.findByText("order-2")
  })

  it("updates an existing real-time order instead of duplicating it", async () => {
    mocks.get.mockResolvedValueOnce(page([order(1)], false, null))
    render(<OrderHistory servicePointId="sp-a" />)
    await screen.findByText("order-1")

    mocks.orderUpdated?.({ order: { ...order(1), status: "cancelled" } })

    await waitFor(() => {
      expect(screen.getAllByText("order-1")).toHaveLength(1)
      expect(screen.getByText("Cancelled")).toBeTruthy()
    })
  })
})
