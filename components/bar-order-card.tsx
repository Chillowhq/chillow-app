"use client"

import { useState } from "react"
import { AlertCircle, CircleCheck, Hash, Play, Truck, Utensils } from "lucide-react"
import { OrderTimer } from "./order-timer"

interface OrderItem {
  orderLineId?: string | null
  itemName: string
  quantity: number
  lineTotal?: number
  type?: "food" | "drinks"
  notes?: string
  fulfillmentStation?: "kitchen" | "bar"
  fulfillmentBehavior?: "prepared" | "direct"
  fulfillmentStatus?: "pending" | "in_progress" | "ready"
}

export interface BarOrder {
  orderId: string
  servicePointLabel: string
  servicePointQrCode?: string
  displayLabel?: string
  status: "placed" | "in_progress" | "ready" | "completed"
  stationStatus?: "placed" | "in_progress" | "ready"
  orderType: "dine-in" | "takeout"
  items: OrderItem[]
  allergies?: string[]
  notes?: string
  createdAt: string
  contactPhone?: string
}

interface BarOrderCardProps {
  order: BarOrder
  onFulfillmentAction: (
    orderId: string,
    action: "start" | "ready",
    orderLineIds: string[],
  ) => Promise<void> | void
}

export function BarOrderCard({ order, onFulfillmentAction }: BarOrderCardProps) {
  const [updating, setUpdating] = useState(false)
  const operationalStatus = order.stationStatus || order.status
  const statusConfig = {
    placed: {
      border: "border-blue-500 shadow-blue-500/20",
      label: "NEW",
      labelBg: "bg-gradient-to-r from-blue-500 to-blue-600",
      cardBg: "bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-900 dark:to-blue-950/20",
    },
    in_progress: {
      border: "border-amber-500 shadow-amber-500/20",
      label: "BAR IN PROGRESS",
      labelBg: "bg-gradient-to-r from-amber-500 to-amber-600",
      cardBg: "bg-gradient-to-br from-amber-50/50 to-amber-50/30 dark:from-amber-950/20 dark:to-amber-950/10",
    },
    ready: {
      border: "border-green-500 shadow-green-500/20",
      label: "READY",
      labelBg: "bg-gradient-to-r from-green-500 to-green-600",
      cardBg: "bg-gradient-to-br from-green-50/50 to-green-50/30 dark:from-green-950/20 dark:to-green-950/10",
    },
    completed: {
      border: "border-gray-300",
      label: "SERVED",
      labelBg: "bg-gradient-to-r from-gray-400 to-gray-500",
      cardBg: "bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900",
    },
  }[operationalStatus]

  const drinkItems = order.items.filter((item) =>
    item.fulfillmentStation ? item.fulfillmentStation === "bar" : item.type === "drinks",
  )
  if (drinkItems.length === 0) return null

  const idsFor = (behavior: "prepared" | "direct", status: "pending" | "in_progress") =>
    drinkItems.filter((item) =>
      item.fulfillmentBehavior === behavior &&
      item.fulfillmentStatus === status &&
      item.orderLineId,
    ).map((item) => item.orderLineId as string)
  const directPendingIds = idsFor("direct", "pending")
  const preparedPendingIds = idsFor("prepared", "pending")
  const preparedInProgressIds = idsFor("prepared", "in_progress")
  const directPendingCount = drinkItems.filter((item) =>
    item.fulfillmentBehavior === "direct" && item.fulfillmentStatus === "pending",
  ).length
  const preparedPendingCount = drinkItems.filter((item) =>
    item.fulfillmentBehavior === "prepared" && item.fulfillmentStatus === "pending",
  ).length
  const preparedInProgressCount = drinkItems.filter((item) =>
    item.fulfillmentBehavior === "prepared" && item.fulfillmentStatus === "in_progress",
  ).length

  const runAction = async (action: "start" | "ready", orderLineIds: string[]) => {
    setUpdating(true)
    try {
      await onFulfillmentAction(order.orderId, action, orderLineIds)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border-b border-r border-t border-l-4 shadow-lg transition-all hover:shadow-xl ${statusConfig.border} ${statusConfig.cardBg}`}>
      <div className="p-5 sm:p-6">
        <div className="mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md ${statusConfig.labelBg}`}>
                {statusConfig.label}
              </span>
              <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/70 px-3 py-1.5 text-[11px] font-bold uppercase text-muted-foreground">
                {order.orderType === "dine-in" ? <Utensils className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                {order.orderType}
              </div>
            </div>
            <OrderTimer variant="severity" createdAt={order.createdAt} />
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-3 py-2 shadow-md dark:from-slate-100 dark:to-slate-200">
              <span className="whitespace-nowrap text-xs font-black text-white dark:text-slate-900">
                {order.displayLabel || order.servicePointQrCode || order.servicePointLabel}
              </span>
            </div>
            <span className="flex items-center gap-1.5 rounded-lg border border-border/30 bg-secondary/50 px-3 py-1.5 text-xs font-bold text-muted-foreground">
              <Hash className="h-3.5 w-3.5" /> {order.orderId}
            </span>
          </div>
        </div>

        {order.notes && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
            <div className="mb-2 flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-wider">Bar alert</span>
            </div>
            <p className="text-sm font-black italic text-red-950 dark:text-red-50">&quot;{order.notes}&quot;</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Drink items</p>
          {drinkItems.map((item, index) => (
            <div key={item.orderLineId || index} className="rounded-lg border border-border bg-white p-3 dark:bg-gray-800">
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold text-foreground">{item.quantity}× {item.itemName}</span>
                <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-black uppercase text-muted-foreground">
                  {item.fulfillmentBehavior === "prepared" ? "Requires preparation" : "Ready to serve"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2 border-t border-border/50 pt-4">
          {directPendingCount > 0 && (
            <button type="button" disabled={updating} onClick={() => runAction("ready", directPendingIds)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-black text-white hover:bg-blue-700 disabled:opacity-50">
              <CircleCheck className="h-5 w-5" /> MARK READY TO SERVE
            </button>
          )}
          {preparedPendingCount > 0 && (
            <button type="button" disabled={updating} onClick={() => runAction("start", preparedPendingIds)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 font-black text-white hover:bg-amber-700 disabled:opacity-50">
              <Play className="h-5 w-5" /> START PREPARATION
            </button>
          )}
          {preparedInProgressCount > 0 && (
            <button type="button" disabled={updating} onClick={() => runAction("ready", preparedInProgressIds)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-black text-white hover:bg-green-700 disabled:opacity-50">
              <CircleCheck className="h-5 w-5" /> MARK PREPARED DRINKS READY
            </button>
          )}
          {operationalStatus === "ready" && (
            <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-green-500 bg-green-100 py-3 font-black text-green-700 dark:bg-green-950/40 dark:text-green-400">
              <Truck className="h-5 w-5" /> READY FOR HANDOFF
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
