"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Clock, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { OrderTimer } from "./order-timer"
import { apiClient } from "@/lib/axios-config"
import { formatPrice } from "@/lib/localization"
import { getBusinessId } from "@/lib/business-info"
import { useEventSource } from "@/hooks/use-event-source"
import { OrderHistorySkeleton } from "@/components/customer-loading-skeletons"
import { ensureSessionId, getTableToken, isTableSessionValid } from "@/lib/guest-session"
import { getHiddenOrderIds, hideOrderIds, isOrderHiddenFromHistory } from "@/lib/order-history-storage"
import { motion, AnimatePresence } from "framer-motion"
import OrderAgainButton from "@/components/order-again-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface OrderHistoryItem {
  orderId: string
  businessId: string
  status: string
  createdAt: string
  updatedAt?: string
  total: number
  currency: string
  items: Array<{ itemName: string; quantity: number }>
}

interface GuestHistoryResponse {
  orders: OrderHistoryItem[]
  nextCursor: string | null
  hasMore: boolean
}

interface OrderHistoryProps {
  servicePointId: string
  currency?: string
  timezone?: string
  onEmptyChange?: (isEmpty: boolean) => void
}

function mergeDistinctOrders(existing: OrderHistoryItem[], incoming: OrderHistoryItem[]) {
  const byId = new Map(existing.map((order) => [order.orderId, order]))
  for (const order of incoming) {
    if (!byId.has(order.orderId)) byId.set(order.orderId, order)
  }
  return Array.from(byId.values())
}

export default function OrderHistory({
  servicePointId,
  currency,
  timezone,
  onEmptyChange,
}: OrderHistoryProps) {
  const router = useRouter()
  const businessId = getBusinessId()
  const deviceSessionId = ensureSessionId()
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [initialError, setInitialError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [hiddenOrders, setHiddenOrders] = useState<string[]>([])
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const requestAbortRef = useRef<AbortController | null>(null)

  const fetchHistoryPage = useCallback(async (cursor: string | null, replace: boolean) => {
    if (!businessId || !deviceSessionId) {
      setOrders([])
      setHasMore(false)
      setNextCursor(null)
      setInitialError(!businessId ? "Business not found" : "Session not found")
      setLoading(false)
      return
    }

    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller
    const requestId = ++requestIdRef.current

    if (replace) {
      setLoading(true)
      setInitialError(null)
      setLoadMoreError(null)
    } else {
      setLoadingMore(true)
      setLoadMoreError(null)
    }

    try {
      const response = await apiClient.get<GuestHistoryResponse>("/orders/history", {
        params: {
          businessId,
          sessionId: deviceSessionId,
          ...(cursor ? { cursor } : {}),
        },
        signal: controller.signal,
      })
      if (controller.signal.aborted || requestId !== requestIdRef.current) return

      const page = Array.isArray(response.data?.orders) ? response.data.orders : []
      setOrders((previous) => (replace ? page : mergeDistinctOrders(previous, page)))
      setNextCursor(response.data?.nextCursor || null)
      setHasMore(response.data?.hasMore === true)
    } catch (err: any) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return
      const message = err?.response?.data?.message || "Failed to fetch order history"
      if (replace) {
        setOrders([])
        setHasMore(false)
        setNextCursor(null)
        setInitialError(message)
      } else {
        setLoadMoreError(message)
      }
    } finally {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return
      if (replace) setLoading(false)
      else setLoadingMore(false)
    }
  }, [businessId, deviceSessionId])

  useEffect(() => {
    setHiddenOrders(getHiddenOrderIds())
    setOrders([])
    setNextCursor(null)
    setHasMore(false)
    void fetchHistoryPage(null, true)

    return () => {
      requestAbortRef.current?.abort()
    }
  }, [businessId, deviceSessionId, fetchHistoryPage])

  // Real-time delivery is scoped by the active GuestSession. It updates an
  // already loaded record, or prepends a newly created current-visit order
  // without changing the cursor that continues the historical query.
  const token = getTableToken(servicePointId)
  const isSessionValid = isTableSessionValid(servicePointId)
  const sseUrl = businessId && deviceSessionId && isSessionValid && token
    ? `/events?role=table&businessId=${encodeURIComponent(businessId)}&token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(deviceSessionId)}`
    : ""

  useEventSource(sseUrl, {
    order_updated: (data: any) => {
      const updatedOrder = data?.order as OrderHistoryItem | undefined
      if (!updatedOrder?.orderId || updatedOrder.businessId !== businessId) return

      setOrders((previous) => {
        const existing = previous.some((order) => order.orderId === updatedOrder.orderId)
        return existing
          ? previous.map((order) => order.orderId === updatedOrder.orderId ? { ...order, ...updatedOrder } : order)
          : [updatedOrder, ...previous]
      })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "placed": return "text-blue-600 bg-blue-50"
      case "in_progress": return "text-amber-600 bg-amber-50"
      case "ready": return "text-green-600 bg-green-50"
      case "completed": return "text-purple-600 bg-purple-50"
      case "cancelled": return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30"
      default: return "text-muted-foreground bg-secondary"
    }
  }

  const handleHideOrder = () => {
    if (!orderToDelete) return
    setHiddenOrders(hideOrderIds([orderToDelete]))
    setOrderToDelete(null)
  }

  const loadMore = () => {
    if (loading || loadingMore || !hasMore || !nextCursor) return
    void fetchHistoryPage(nextCursor, false)
  }

  const visibleOrders = orders.filter((order) => !isOrderHiddenFromHistory(
    order,
    { businessId, sessionId: deviceSessionId || "" },
    hiddenOrders,
  ))

  useEffect(() => {
    if (!loading) onEmptyChange?.(visibleOrders.length === 0 && !hasMore)
  }, [hasMore, loading, onEmptyChange, visibleOrders.length])

  if (loading) return <OrderHistorySkeleton />

  if (initialError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{initialError}</p>
        <button
          type="button"
          onClick={() => void fetchHistoryPage(null, true)}
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 overflow-x-hidden">
      {visibleOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No orders yet</p>
        </div>
      )}

      <AnimatePresence>
        {visibleOrders.map((order) => (
          <motion.div
            key={order.orderId}
            initial={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            className="relative mb-3 last:mb-0 rounded-lg bg-red-500"
          >
            <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-end px-4">
              <button
                type="button"
                onClick={() => setOrderToDelete(order.orderId)}
                className="flex h-full w-full flex-col items-center justify-center text-white"
              >
                <Trash2 className="mb-1 h-5 w-5" />
                <span className="text-xs font-medium">Delete</span>
              </button>
            </div>

            <motion.div
              drag="x"
              dragConstraints={{ left: -80, right: 0 }}
              dragElastic={0.1}
              whileTap={{ cursor: "grabbing" }}
              className="relative w-full cursor-pointer rounded-lg border border-border bg-card p-4"
              onClick={() => {
                router.push(
                  `/s/${servicePointId}/status?orderId=${encodeURIComponent(order.orderId)}&businessId=${encodeURIComponent(order.businessId || businessId)}&scope=history`,
                )
              }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{order.orderId}</p>
                  <OrderTimer createdAt={order.createdAt} timezone={timezone} showAbsolute />
                </div>
                <div className="flex flex-col items-end">
                  <span className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                    {order.status === "completed"
                      ? "Served"
                      : order.status === "ready"
                        ? "Ready"
                        : order.status === "in_progress"
                          ? "In Progress"
                          : order.status === "cancelled"
                            ? "Cancelled"
                            : "Placed"}
                  </span>
                  <span className="text-sm font-black text-primary">
                    {formatPrice(order.total, order.currency || currency)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {order.items.map((item) => `${item.quantity} × ${item.itemName}`).join(", ")}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    router.push(
                      `/s/${servicePointId}/status?orderId=${encodeURIComponent(order.orderId)}&businessId=${encodeURIComponent(order.businessId || businessId)}&scope=history`,
                    )
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary py-2.5 text-xs font-bold text-foreground transition-all hover:bg-secondary/80 active:scale-95"
                >
                  View
                </button>
                <div className="flex-1">
                  <OrderAgainButton orderId={order.orderId} servicePointId={servicePointId} block />
                </div>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>

      {loadMoreError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-center">
          <p className="text-sm text-destructive">{loadMoreError}</p>
          <button
            type="button"
            onClick={loadMore}
            className="mt-2 text-sm font-semibold text-primary underline underline-offset-4"
          >
            Retry
          </button>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex min-w-44 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loadingMore ? "Loading more orders…" : "Load More Orders"}
          </button>
        </div>
      )}

      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order from history?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The order will be removed from your device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHideOrder} className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
