"use client"

import { useState } from "react"
import { ChefHat, CircleCheck as CheckCircle2, Truck, CircleAlert as AlertCircle, Phone, X, Hash, Utensils } from "lucide-react"
import { OrderTimer } from "./order-timer"

interface OrderItem {
  orderLineId?: string | null
  itemName: string
  quantity: number
  lineTotal?: number
  orderCategory?: "food" | "drinks"
  notes?: string
  fulfillmentStation?: "kitchen" | "bar"
  fulfillmentBehavior?: "prepared" | "direct"
  fulfillmentStatus?: "pending" | "in_progress" | "ready"
}

export interface KitchenOrder {
  orderId: string
  servicePointLabel: string   // internal — system ID
  displayLabel?: string        // human-friendly label (e.g. "Table 4")
  servicePointQrCode?: string    // short code fallback (e.g. "T3")
  status: "placed" | "in_progress" | "ready" | "completed"
  stationStatus?: "placed" | "in_progress" | "ready"
  orderType: "dine-in" | "takeout"
  items: OrderItem[]
  allergies?: string[]
  notes?: string
  createdAt: string
  readyAt?: string
  contactPhone?: string
  customerName?: string
  subtotalCents?: number
  taxCents?: number
  total?: number
  totalCents?: number
  tipAmount?: number
  tipType?: "percentage" | "custom" | null
  tipPercentage?: number | null
  currency?: string
  paymentChannel?: "online" | "offline"
  paymentStatus?: "paid" | "unpaid" | "pending"
  paidVia?: "online_card" | "pos_card" | "cash" | null
}

interface KitchenOrderCardProps {
  order: KitchenOrder
  onFulfillmentAction: (orderId: string, action: "start" | "ready") => Promise<void> | void
  onCancel?: (orderId: string) => Promise<void> | void
}


export function KitchenOrderCard({ order, onFulfillmentAction, onCancel }: KitchenOrderCardProps) {
  const [updating, setUpdating] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})

  const toggleItem = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const handleFulfillmentAction = async (action: "start" | "ready") => {
    setUpdating(true)
    try {
      await onFulfillmentAction(order.orderId, action)
    } catch (err) {
      console.error("Failed to update order status:", err)
    } finally {
      setUpdating(false)
    }
  }

  const getStatusConfig = (status: KitchenOrder["status"]) => {
    const configs = {
      placed: {
        border: "border-blue-500 shadow-lg shadow-blue-500/20",
        label: "NEW",
        labelBg: "bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg",
        cardBg: "bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-900 dark:to-blue-950/20",
      },
      in_progress: {
        border: "border-amber-500 shadow-lg shadow-amber-500/20",
        label: "COOKING",
        labelBg: "bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg",
        cardBg: "bg-gradient-to-br from-amber-50/50 to-amber-50/30 dark:from-amber-950/20 dark:to-amber-950/10",
      },
      ready: {
        border: "border-green-500 shadow-lg shadow-green-500/20",
        label: "READY",
        labelBg: "bg-gradient-to-r from-green-500 to-green-600 shadow-lg",
        cardBg: "bg-gradient-to-br from-green-50/50 to-green-50/30 dark:from-green-950/20 dark:to-green-950/10",
      },
      completed: {
        border: "border-gray-300 shadow-sm",
        label: "SERVED",
        labelBg: "bg-gradient-to-r from-gray-400 to-gray-500 shadow-md",
        cardBg: "bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900",
      },
    }
    return configs[status] || configs.placed
  }

  const operationalStatus = order.stationStatus || order.status
  const statusConfig = getStatusConfig(operationalStatus)

  // Filter out drinks for kitchen view
  const foodItems = order.items.filter((item) =>
    item.fulfillmentStation ? item.fulfillmentStation === "kitchen" : item.orderCategory !== "drinks",
  )

  if (foodItems.length === 0) {
    return null
  }

  return (
    <div
      className={`relative border-l-4 rounded-2xl shadow-lg border-t border-r border-b overflow-hidden transition-all duration-300 hover:shadow-xl ${statusConfig.border} ${statusConfig.cardBg}`}
    >
      <div className="p-5 sm:p-6">
        {/* Header Section - Two Line Layout */}
        <div className="mb-5 space-y-3">
          {/* First Line: Status, Order Type, Timer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-black px-3 py-1.5 rounded-lg text-white uppercase tracking-wider shadow-md ${statusConfig.labelBg}`}>
                {statusConfig.label}
              </span>
              <div className="flex items-center gap-1.5 bg-secondary/70 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase text-muted-foreground border border-border/50">
                {order.orderType === "dine-in" ? <Utensils className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                {order.orderType}
              </div>
            </div>
            <OrderTimer variant="severity" createdAt={order.createdAt} />
          </div>

          {/* Second Line: Table Number + Order ID */}
          <div className="flex items-center gap-3">
            {/* Table Number Badge - Enhanced */}
             <div className="inline-flex items-center gap-2 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-100 dark:to-slate-200 rounded-xl px-3 py-2 shadow-md">
                            <span className="text-xs font-black text-white dark:text-slate-900 leading-none whitespace-nowrap">
                                {order.displayLabel || order.servicePointQrCode || order.servicePointLabel} 
                            </span>
                        </div>

            {/* Order ID */}
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-lg font-bold border border-border/30">
              <Hash className="w-3.5 h-3.5" />
              <span>{order.orderId}</span>
            </span>
          </div>
        </div>

        {/* Important Alerts */}
        {(order.allergies?.length || order.notes) && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3 text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">Kitchen Alerts</span>
            </div>

            {order.allergies && order.allergies.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold text-red-500/80 uppercase mb-1.5 ml-0.5">Allergies</p>
                <div className="flex flex-wrap gap-1.5">
                  {order.allergies.map((allergy, idx) => (
                    <span key={idx} className="inline-block px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded shadow-sm">
                      NO {allergy.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {order.notes && (
              <div className="mt-2 bg-white/60 dark:bg-black/20 border-2 border-red-200/60 dark:border-red-900/60 rounded-lg p-2.5">
                <p className="text-[10px] font-extrabold text-red-600 dark:text-red-400 uppercase mb-1 tracking-wide">Special Requests</p>
                <p className="text-sm font-black text-red-950 dark:text-red-50 italic leading-snug">"{order.notes}"</p>
              </div>
            )}
          </div>
        )}

        {/* Order Items Checklist */}
        <div className="space-y-1 mb-6">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-widest">Items List</p>
          {foodItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => toggleItem(idx)}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${checkedItems[idx] ? "bg-gray-100 dark:bg-gray-800 opacity-50" : "bg-white dark:bg-gray-800 border border-border"
                }`}
            >
              <div className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checkedItems[idx] ? "bg-green-500 border-green-500" : "border-gray-300"
                }`}>
                {checkedItems[idx] && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className={`font-bold text-lg ${checkedItems[idx] ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.quantity}× {item.itemName}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border">
          {operationalStatus === "placed" && (
            <button
              onClick={() => handleFulfillmentAction("start")}
              disabled={updating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <ChefHat className="w-5 h-5" />
              START ORDER
            </button>
          )}

          {operationalStatus === "in_progress" && (
            <button
              onClick={() => handleFulfillmentAction("ready")}
              disabled={updating}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5" />
              MARK READY
            </button>
          )}

          {operationalStatus === "ready" && (
            <div className="flex-1 bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 font-black py-4 rounded-xl flex items-center justify-center gap-2 border-2 border-green-500 animate-pulse">
              <Truck className="w-5 h-5" />
              READY TO SERVE
            </div>
          )}

          {/* <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <MoreVertical className="w-6 h-6" />
          </button> */}
        </div>
      </div>

      {/* Simplified Dropdown */}
      {showMenu && (
        <div className="absolute bottom-20 right-4 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-border z-30 overflow-hidden">
          <button
            onClick={() => {
              if (onCancel) onCancel(order.orderId);
              setShowMenu(false);
            }}
            className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 text-red-600 font-bold flex items-center gap-2"
          >
            <X className="w-4 h-4" /> Cancel Order
          </button>
          {order.contactPhone && (
            <a href={`tel:${order.contactPhone}`} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-border">
              <Phone className="w-4 h-4" /> Call Customer
            </a>
          )}
        </div>
      )}
    </div>
  )
}
