interface ReservationPaymentStatusBadgeProps {
  paymentStatus?: string
  reservationStatus: string
  refundPending?: boolean
}

const PAYMENT_STYLES = {
  paid: {
    label: "Paid",
    dot: "bg-green-500",
    classes:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300",
  },
  awaiting: {
    label: "Awaiting Payment",
    dot: "bg-orange-500",
    classes:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300",
  },
  pending: {
    label: "Not Started",
    dot: "bg-gray-400",
    classes:
      "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  },
  failed: {
    label: "Failed",
    dot: "bg-red-500",
    classes:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  },
  refunded: {
    label: "Refunded",
    dot: "bg-purple-500",
    classes:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300",
  },
  partiallyRefunded: {
    label: "Partially Refunded",
    dot: "bg-violet-500",
    classes:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300",
  },
  retained: {
    label: "Payment Retained",
    dot: "bg-blue-500",
    classes:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  },
  refundPending: {
    label: "Refund Pending",
    dot: "bg-amber-500",
    classes:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  },
  expired: {
    label: "Expired",
    dot: "bg-gray-500",
    classes:
      "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
  },
} as const

export function ReservationPaymentStatusBadge({
  paymentStatus,
  reservationStatus,
  refundPending = false,
}: ReservationPaymentStatusBadgeProps) {
  let style: (typeof PAYMENT_STYLES)[keyof typeof PAYMENT_STYLES] =
    PAYMENT_STYLES.pending

  if (refundPending) style = PAYMENT_STYLES.refundPending
  else if (paymentStatus === "paid" && reservationStatus === "cancelled") {
    style = PAYMENT_STYLES.retained
  }
  else if (paymentStatus === "paid") style = PAYMENT_STYLES.paid
  else if (paymentStatus === "failed") style = PAYMENT_STYLES.failed
  else if (paymentStatus === "partially_refunded") {
    style = PAYMENT_STYLES.partiallyRefunded
  }
  else if (paymentStatus === "refunded") style = PAYMENT_STYLES.refunded
  else if (reservationStatus === "expired") style = PAYMENT_STYLES.expired
  else if (
    paymentStatus === "pending" &&
    !["pending", "pending_approval"].includes(reservationStatus)
  ) {
    style = PAYMENT_STYLES.awaiting
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${style.classes}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}
