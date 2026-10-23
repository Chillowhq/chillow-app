"use client"

import {
  Check,
  ChefHat,
  Clipboard,
  Mail,
  MapPin,
  Package,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react"
import { toast } from "sonner"

import {
  OwnerOrderPaymentBadge,
  OwnerOrderStatusBadge,
  formatOrderStatus,
  formatOrderType,
} from "@/components/orders/OwnerOrderBadges"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatDateTime, formatPrice, pluralize } from "@/lib/localization"
import { formatOrderReference } from "@/lib/order-reference"
import type { OwnerOrder, OwnerOrderStatus } from "@/types/owner-orders"

const LIFECYCLE: OwnerOrderStatus[] = ["placed", "in_progress", "ready", "completed"]

function SummaryItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="min-w-0 text-sm font-semibold text-foreground">{children}</div>
    </div>
  )
}

export function OwnerOrderDetailsSheet({
  order,
  open,
  onOpenChange,
  currency,
  timezone,
}: {
  order: OwnerOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  timezone: string
}) {
  if (!order) return null

  const orderCurrency = order.currency || currency
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0)
  const currentLifecycleIndex = LIFECYCLE.indexOf(order.status)

  const copyCanonicalId = async () => {
    try {
      await navigator.clipboard.writeText(order.orderId)
      toast.success("Order ID copied")
    } catch {
      toast.error("Could not copy the order ID")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-[460px]"
        aria-describedby="owner-order-details-description"
      >
        <SheetHeader className="shrink-0 border-b border-border bg-card px-5 py-5 pr-12 text-left">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base font-bold">Order Details</SheetTitle>
            <OwnerOrderStatusBadge status={order.status} />
          </div>
          <div className="pt-1">
            <p className="text-3xl font-black tracking-tight text-foreground">
              {formatOrderReference(order.orderId)}
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <code className="min-w-0 truncate text-xs text-muted-foreground" title={order.orderId}>
                {order.orderId}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void copyCanonicalId()}
                className="h-8 w-8 shrink-0"
                aria-label={`Copy full order ID ${order.orderId}`}
              >
                <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <SheetDescription id="owner-order-details-description" suppressHydrationWarning>
            Placed {formatDateTime(order.createdAt, timezone)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto bg-secondary/10 px-5 py-5">
          <section aria-labelledby="order-summary-title">
            <h2 id="order-summary-title" className="mb-3 text-sm font-bold text-foreground">
              Summary
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <SummaryItem icon={MapPin} label="Service Point">
                <span className="block truncate" title={order.servicePointLabel}>
                  {order.servicePointLabel || "Not recorded"}
                </span>
              </SummaryItem>
              <SummaryItem
                icon={order.orderType === "dine-in" ? UtensilsCrossed : ShoppingBag}
                label="Type"
              >
                {formatOrderType(order.orderType)}
              </SummaryItem>
              <SummaryItem icon={Package} label="Payment">
                <OwnerOrderPaymentBadge status={order.paymentStatus} />
              </SummaryItem>
              <SummaryItem icon={Check} label="Status">
                <OwnerOrderStatusBadge status={order.status} />
              </SummaryItem>
            </div>
          </section>

          <section aria-labelledby="order-lifecycle-title">
            <h2 id="order-lifecycle-title" className="mb-3 text-sm font-bold text-foreground">
              Lifecycle
            </h2>
            <ol className="grid grid-cols-4 gap-1" aria-label="Read-only order lifecycle">
              {LIFECYCLE.map((status, index) => {
                const reached = currentLifecycleIndex >= index
                return (
                  <li key={status} className="min-w-0 text-center">
                    <div className="flex items-center" aria-hidden="true">
                      <span
                        className={`h-1 flex-1 rounded-full ${reached ? "bg-primary" : "bg-border"}`}
                      />
                    </div>
                    <span className={`mt-1.5 block text-[10px] font-semibold ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                      {formatOrderStatus(status)}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          <section aria-labelledby="customer-information-title">
            <h2 id="customer-information-title" className="mb-3 text-sm font-bold text-foreground">
              Customer Information
            </h2>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground">Email</p>
                <p className="break-all text-sm font-semibold text-foreground">
                  {order.receiptEmail || "Not provided"}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="staff-attribution-title">
            <h2 id="staff-attribution-title" className="mb-3 text-sm font-bold text-foreground">
              Staff Attribution
            </h2>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChefHat className="h-4 w-4" aria-hidden="true" />
                Completed by
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {order.completedBy || "Not recorded"}
              </span>
            </div>
          </section>

          <section aria-labelledby="order-items-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="order-items-title" className="text-sm font-bold text-foreground">
                Order Items
              </h2>
              <span className="text-xs text-muted-foreground">
                {itemCount} {pluralize(itemCount, "item")}
              </span>
            </div>
            <ul className="space-y-2">
              {order.items.map((item, index) => (
                <li key={`${item.itemName}-${index}`} className="rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-secondary px-1 text-xs font-bold">
                        {item.quantity}x
                      </span>
                      <p className="min-w-0 text-sm font-semibold text-foreground">{item.itemName}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-foreground">
                      {formatPrice(item.lineTotal || 0, orderCurrency)}
                    </span>
                  </div>
                  {item.notes ? (
                    <p className="mt-2 pl-10 text-xs text-muted-foreground">Note: {item.notes}</p>
                  ) : null}
                  {item.allergies?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1 pl-10" aria-label="Allergy information">
                      {item.allergies.map((allergy) => (
                        <span key={allergy} className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                          {allergy}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="order-pricing-title">
            <h2 id="order-pricing-title" className="mb-3 text-sm font-bold text-foreground">
              Pricing
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-semibold">{formatPrice(order.subtotal, orderCurrency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="font-semibold">{formatPrice(order.taxAmount, orderCurrency)}</dd>
                </div>
                {Number(order.platformFeeTotal || 0) > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Service fee</dt>
                    <dd className="font-semibold">{formatPrice(order.platformFeeTotal, orderCurrency)}</dd>
                  </div>
                ) : null}
                {Number(order.tipAmount || 0) > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Tip</dt>
                    <dd className="font-semibold">{formatPrice(Number(order.tipAmount), orderCurrency)}</dd>
                  </div>
                ) : null}
                <div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3">
                  <dt className="font-bold text-foreground">Total</dt>
                  <dd className="text-lg font-black text-foreground">{formatPrice(order.total, orderCurrency)}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>

        <SheetFooter className="shrink-0 border-t border-border bg-card p-4">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="w-full font-semibold">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
