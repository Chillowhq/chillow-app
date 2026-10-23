export type TransactionPaymentStatus =
  | "paid"
  | "unpaid"
  | "pending"
  | "failed"
  | "partially_refunded"
  | "refunded"

export type TransactionPaymentChannel = "online" | "offline"
export type TransactionPaidVia = "online_card" | "pos_card" | "cash"
export type TransactionTimeRange =
  | "today"
  | "yesterday"
  | "7days"
  | "thisMonth"
  | "custom"

export interface TransactionItem {
  itemName: string
  quantity: number
  lineTotal: number
  notes?: string
  allergies?: string[]
}

export interface TransactionRefundAdjustment {
  refundId: string
  amountCents: number
  currency: string
  type: "full" | "partial"
  status: "succeeded"
  reason: string
  refundedAt?: string
  providerRefundId?: string
}

export interface OwnerTransaction {
  sourceType: "order" | "reservation"
  transactionId: string
  reservationId?: string
  orderId: string
  servicePointLabel: string
  orderType: string
  items: TransactionItem[]
  total: number
  paymentStatus: TransactionPaymentStatus
  paymentChannel: TransactionPaymentChannel
  paidVia: TransactionPaidVia | null
  status: string
  createdAt: string
  updatedAt?: string
  paidAt?: string
  receiptSent?: boolean
  receiptEmail?: string
  receiptSentAt?: string
  subtotal?: number
  taxRateApplied?: number
  taxLabel?: string
  taxAmount?: number
  platformFeeLabel?: string
  platformFeeTotal?: number
  platformFeeCents?: number
  customerPlatformFeeCents?: number
  businessAbsorbedPlatformFeeCents?: number
  grossAmount?: number
  netToBusinessAmount?: number
  originalAmountPaidCents?: number
  refundedAmountCents?: number
  netRetainedAmountCents?: number
  paymentReconciliationStatus?: "required" | "resolved" | null
  unexpectedPaymentCount?: number
  unexpectedPaymentAmountCents?: number
  providerCapturedAmountCents?: number
  lastUnexpectedPaymentAt?: string
  refundStatus?: TransactionPaymentStatus
  lastRefundAt?: string
  refundReason?: string
  refundAdjustments?: TransactionRefundAdjustment[]
  cancellationOutcome?:
    | "unpaid"
    | "no_refund"
    | "full_refund"
    | "partial_refund"
  tipAmount?: number
  tipType?: "percentage" | "custom" | null
  tipPercentage?: number | null
  currency?: string
  customerName?: string
  checkInDate?: string
  checkOutDate?: string
}

export interface TransactionSummary {
  totalRevenue: number
  totalQuickServeFees: number
  netRevenue: number
  totalTips: number
  paidOrders: number
  pendingOrders: number
  onlinePayments: number
  offlinePayments: number
}

export interface TransactionPagination {
  nextCursor: string | null
  previousCursor: string | null
  hasNextPage: boolean
  hasPreviousPage: boolean
  limit: number
  totalCount: number
}
