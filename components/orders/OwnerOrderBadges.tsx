import { CircleCheck, CircleDollarSign, Clock3, PackageCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import type {
  OwnerOrderPaymentStatus,
  OwnerOrderStatus,
  OwnerOrderType,
} from "@/types/owner-orders"

export function formatOrderStatus(status: OwnerOrderStatus): string {
  if (status === "in_progress") return "In Progress"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function formatOrderType(orderType: OwnerOrderType): string {
  return orderType === "dine-in" ? "Dine In" : "Takeout"
}

const statusStyles: Record<OwnerOrderStatus, string> = {
  placed: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  in_progress:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  ready:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  completed:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
}

export function OwnerOrderStatusBadge({
  status,
  className,
}: {
  status: OwnerOrderStatus
  className?: string
}) {
  const Icon = status === "completed" ? CircleCheck : status === "ready" ? PackageCheck : Clock3

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide",
        statusStyles[status],
        className,
      )}
      aria-label={`Order status: ${formatOrderStatus(status)}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {formatOrderStatus(status)}
    </span>
  )
}

const paymentStyles: Record<OwnerOrderPaymentStatus, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  unpaid: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
}

export function OwnerOrderPaymentBadge({
  status,
  className,
}: {
  status: OwnerOrderPaymentStatus
  className?: string
}) {
  const label = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide",
        paymentStyles[status],
        className,
      )}
      aria-label={`Payment status: ${label}`}
    >
      <CircleDollarSign className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}
