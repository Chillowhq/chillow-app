"use client"

import { useState } from "react"
import {
    Clock,
    CheckCircle2,
    RefreshCw,
    Hash,
    Utensils,
    Truck,
    Hourglass,
    AlertCircle,
    CreditCard,
    Wallet,
    Banknote,
    X,
    Mail,
    Send,
} from "lucide-react"
import { KitchenOrder } from "@/components/kitchen-order-card"
import { apiClient } from "@/lib/axios-config"
import { toast } from "sonner"
import { formatPrice } from "@/lib/localization"
import { OrderTimer } from "./order-timer"

// Payment Selector Component
function MarkPaidSelector({
    onSelect,
    onCancel,
    loading,
    paymentPreferences
}: {
    onSelect: (method: "cash" | "pos_card") => void,
    onCancel: () => void,
    loading: boolean,
    paymentPreferences?: {
        acceptCash: boolean,
        acceptPosCard: boolean
    }
}) {
    // Default to true if not provided (fallback)
    const showCash = paymentPreferences?.acceptCash ?? true
    const showPos = paymentPreferences?.acceptPosCard ?? true

    return (
        <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 z-20 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <button
                onClick={onCancel}
                className="absolute top-2 right-2 p-2 hover:bg-secondary rounded-full transition-colors"
            >
                <X className="w-5 h-5 text-muted-foreground" />
            </button>

            <h4 className="text-sm font-black uppercase tracking-widest mb-4 text-foreground">How did the customer pay? </h4>

            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                {showCash && (
                    <button
                        disabled={loading}
                        onClick={() => onSelect("cash")}
                        className="flex flex-col items-center gap-2 p-4 bg-card hover:bg-secondary border border-border rounded-xl transition-all hover:scale-105 active:scale-95"
                    >
                        <Banknote className="w-8 h-8 text-green-600" />
                        <span className="text-[10px] font-black uppercase">Cash</span>
                    </button>
                )}

                {showPos && (
                    <button
                        disabled={loading}
                        onClick={() => onSelect("pos_card")}
                        className="flex flex-col items-center gap-2 p-4 bg-card hover:bg-secondary border border-border rounded-xl transition-all hover:scale-105 active:scale-95"
                    >
                        <CreditCard className="w-8 h-8 text-blue-600" />
                        <span className="text-[10px] font-black uppercase">POS Card</span>
                    </button>
                )}
            </div>
        </div>
    )
}

// Cancel Confirmation Modal Component
function ConfirmCancelModal({
    onConfirm,
    onCancel,
    loading
}: {
    onConfirm: () => void,
    onCancel: () => void,
    loading: boolean
}) {
    return (
        <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 z-30 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-200 shadow-xl border border-border/50 rounded-xl">
            <h4 className="text-base font-black text-foreground mb-2 text-center tracking-tight">Cancel this order?</h4>
            <p className="text-xs text-muted-foreground text-center mb-6 max-w-[240px] leading-relaxed">
                This action cannot be undone and will restore inventory.
            </p>

            <div className="flex gap-3 w-full max-w-[240px]">
                <button
                    disabled={loading}
                    onClick={onCancel}
                    className="flex-1 px-4 py-2.5 bg-background border-2 border-orange-200/50 dark:border-orange-900/30 text-foreground font-bold rounded-xl transition-all hover:bg-secondary active:scale-95 disabled:opacity-50"
                >
                    Go Back
                </button>
                <button
                    disabled={loading}
                    onClick={onConfirm}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 shadow-sm"
                >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Cancel Order"}
                </button>
            </div>
        </div>
    )
}


interface WaiterOrderCardProps {
    order: KitchenOrder
    onMarkServed: (orderId: string) => Promise<void>
    onMarkPaid?: (orderId: string, paidVia: "cash" | "pos_card") => Promise<void>
    onCancelOrder?: (orderId: string) => Promise<void>
    paymentPreferences?: {
        acceptCash: boolean
        acceptPosCard: boolean
    }
    currency?: string
}

function getStatusStyles(status: KitchenOrder["status"]) {
    const map = {
        placed: {
            border: "border-blue-500",
            badgeBg: "bg-blue-500",
            cardBg: "bg-white dark:bg-gray-900",
            pillBg: "bg-blue-500/10",
            pillText: "text-blue-600 dark:text-blue-400",
            label: "PLACED",
        },
        in_progress: {
            border: "border-amber-500",
            badgeBg: "bg-amber-500",
            cardBg: "bg-amber-50/30 dark:bg-amber-950/10",
            pillBg: "bg-amber-500/10",
            pillText: "text-amber-700 dark:text-amber-400",
            label: "IN PROGRESS",
        },
        ready: {
            border: "border-green-500",
            badgeBg: "bg-green-500",
            cardBg: "bg-green-50/30 dark:bg-green-950/10",
            pillBg: "bg-green-500/10",
            pillText: "text-green-700 dark:text-green-400",
            label: "READY",
        },
        completed: {
            border: "border-gray-300",
            badgeBg: "bg-gray-400",
            cardBg: "bg-gray-50 dark:bg-gray-900",
            pillBg: "bg-gray-200",
            pillText: "text-gray-700",
            label: "COMPLETED",
        },
    } as const

    return map[status] || map.placed
}

export function WaiterOrderCard({ order, onMarkServed, onMarkPaid, onCancelOrder, paymentPreferences, currency = "USD" }: WaiterOrderCardProps) {
    const [updating, setUpdating] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [showPaymentSelector, setShowPaymentSelector] = useState(false)
    const [markingPaid, setMarkingPaid] = useState(false)
    const [receiptEmail, setReceiptEmail] = useState("")
    const [sendingReceipt, setSendingReceipt] = useState(false)
    const [receiptSent, setReceiptSent] = useState(false)

    const styles = getStatusStyles(order.status)
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
    const tipAmount = Number(order.tipAmount || 0)

    const handleMarkServed = async () => {
        setUpdating(true)
        try {
            await onMarkServed(order.orderId)
        } catch (err) {
            console.error("Failed to mark order as served:", err)
        } finally {
            setUpdating(false)
        }
    }

    const handleMarkPaid = async (method: "cash" | "pos_card") => {
        if (!onMarkPaid) return
        setMarkingPaid(true)
        try {
            await onMarkPaid(order.orderId, method)
            setShowPaymentSelector(false)
        } catch (err) {
            console.error("Failed to mark order as paid:", err)
        } finally {
            setMarkingPaid(false)
        }
    }

    const handleCancelOrder = async () => {
        if (!onCancelOrder) return
        setCancelling(true)
        try {
            await onCancelOrder(order.orderId)
            toast.success("Order cancelled successfully.")
            setShowCancelConfirm(false)
        } catch (err: any) {
            console.error("Failed to cancel order:", err)
            toast.error(err.response?.data?.error || "Failed to cancel order")
        } finally {
            setCancelling(false)
        }
    }

    const handleSendReceipt = async () => {
        if (!receiptEmail) {
            toast.error("Please enter an email address")
            return
        }
        setSendingReceipt(true)
        try {
            await apiClient.post(`/orders/${order.orderId}/receipt`, { email: receiptEmail })
            toast.success("Receipt sent successfully")
            setReceiptSent(true)
            setReceiptEmail("")
        } catch (err: any) {
            console.error("Failed to send receipt:", err)
            toast.error(err.response?.data?.message || "Failed to send receipt")
        } finally {
            setSendingReceipt(false)
        }
    }

    const isOfflineUnpaid = order.paymentChannel === "offline" && order.paymentStatus !== "paid"
    const canServe = order.status === "ready" && !isOfflineUnpaid
    const showServedButton = order.status === "ready"

    return (
        <div
            className={`relative border-l-[6px] rounded-xl shadow-sm border-t border-r border-b overflow-hidden transition-all duration-200 ${styles.border} ${styles.cardBg}`}
        >
            {showCancelConfirm && (
                <ConfirmCancelModal
                    loading={cancelling}
                    onConfirm={handleCancelOrder}
                    onCancel={() => setShowCancelConfirm(false)}
                />
            )}

            {showPaymentSelector && (
                <MarkPaidSelector
                    loading={markingPaid}
                    onSelect={handleMarkPaid}
                    onCancel={() => setShowPaymentSelector(false)}
                    paymentPreferences={paymentPreferences}
                />
            )}

            <div className="p-4">
                {/* Header */}
                <div className="mb-4 space-y-3">
                    {/* Line 1 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center flex-wrap gap-2">
                            <span
                                className={`text-[10px] font-black px-2.5 py-1 rounded-md text-white uppercase tracking-wide shadow-sm ${styles.badgeBg}`}
                            >
                                {styles.label}
                            </span>

                            <div className="flex items-center gap-1.5 bg-secondary/60 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase text-muted-foreground">
                                {order.orderType === "dine-in" ? (
                                    <Utensils className="w-3 h-3" />
                                ) : (
                                    <Truck className="w-3 h-3" />
                                )}
                                {order.orderType}
                            </div>

                            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md ${styles.pillBg}`}>
                                <span className={`text-[10px] font-black ${styles.pillText}`}>
                                    {itemCount} {itemCount === 1 ? "ITEM" : "ITEMS"}
                                </span>
                            </div>
                        </div>

                        {/* Only really meaningful once ready; but harmless elsewhere */}
                        <OrderTimer
                            variant="severity"
                            createdAt={order.readyAt || order.createdAt}
                        />
                    </div>

                    {/* Payment Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {order.paymentStatus === "paid" && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20">
                                <span className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> ✅ PAID
                                    {order.paidVia && (
                                        <span className="opacity-60 ml-1">
                                            ({order.paidVia === "online_card" ? "ONLINE" : order.paidVia === "pos_card" ? "POS" : "CASH"})
                                        </span>
                                    )}
                                </span>
                            </div>
                        )}
                        {order.paymentStatus === "unpaid" && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                                <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
                                    <Wallet className="w-3 h-3" /> 🟧 UNPAID
                                </span>
                            </div>
                        )}
                        {order.paymentStatus === "pending" && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                                <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                    <Clock className="w-3 h-3" /> 🟧 PENDING PAYMENT
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Line 2 */}
                    <div className="flex items-center gap-3">
                      

                          <div className="inline-flex items-center gap-2 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-100 dark:to-slate-200 rounded-xl px-3 py-2 shadow-md">
                            <span className="text-xs font-black text-white dark:text-slate-900 leading-none whitespace-nowrap">
                                {order.displayLabel || order.servicePointQrCode || order.servicePointLabel} 
                            </span>
                        </div>

                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            <span className="font-medium">{order.orderId}</span>
                        </span>
                    </div>
                </div>

                {/* Allergies */}
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


                {/* Items */}
                <div className="space-y-1 mb-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-widest">
                        Items
                    </p>
                    <div className="bg-white dark:bg-gray-800 border border-border rounded-lg p-3 space-y-2">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                                <span className="font-semibold text-sm text-foreground">
                                    {item.quantity}x {item.itemName}
                                </span>

                                {typeof item.lineTotal === "number" && (
                                    <span className="text-sm font-medium text-muted-foreground">
                                        {formatPrice(item.lineTotal, currency)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Total (only if present) */}
                {typeof order.total === "number" && (
                    <div className="mb-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                        {tipAmount > 0 && (
                            <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                    Tip
                                </span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                    {formatPrice(tipAmount, currency)}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                Order Total
                            </span>
                            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                                {formatPrice(order.total, currency)}
                            </span>
                        </div>
                    </div>
                )}


                {/* Action Row */}
                <div className="flex flex-col gap-2">
                    {order.paymentChannel === "offline" && order.status === "placed" && (
                        <button
                            onClick={() => setShowCancelConfirm(true)}
                            disabled={cancelling}
                            className="w-full bg-red-100 hover:bg-red-200 dark:bg-red-950/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm border border-red-200 dark:border-red-900/50"
                        >
                            {cancelling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            CANCEL ORDER
                        </button>
                    )}

                    {order.paymentStatus === "unpaid" && order.paymentChannel === "offline" && (
                        <button
                            onClick={() => setShowPaymentSelector(true)}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <CreditCard className="w-5 h-5" />
                            MARK AS PAID
                        </button>
                    )}

                    {showServedButton ? (
                        <div className="space-y-2">
                            <button
                                onClick={handleMarkServed}
                                disabled={updating || !canServe}
                                className={`w-full font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm ${canServe
                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                    : "bg-gray-200 dark:bg-gray-800 text-muted-foreground cursor-not-allowed border border-dashed border-gray-300 dark:border-gray-700"
                                    }`}
                            >
                                {updating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                MARK SERVED
                            </button>

                            {!canServe && isOfflineUnpaid && (
                                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 text-center uppercase tracking-wider animate-pulse">
                                    ⚠️ Collect payment before serving
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="w-full py-4 rounded-xl border border-border bg-secondary/40 text-muted-foreground font-extrabold flex items-center justify-center gap-2 text-sm uppercase">
                            <Hourglass className="w-5 h-5" />
                            Waiting for Ready
                        </div>
                    )}
                </div>
                
                {/* Send Receipt */}
                {order.paymentStatus === "paid" && (
                    <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-widest flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Customer Receipt
                        </p>
                        <div className="flex items-center gap-2">
                            <input 
                                type="email"
                                placeholder="customer@example.com"
                                value={receiptEmail}
                                onChange={(e) => setReceiptEmail(e.target.value)}
                                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button
                                onClick={handleSendReceipt}
                                disabled={sendingReceipt || !receiptEmail}
                                className="bg-secondary hover:bg-secondary/80 disabled:opacity-50 text-foreground font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                            >
                                {sendingReceipt ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Send
                            </button>
                        </div>
                        {receiptSent && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Receipt has been sent.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
