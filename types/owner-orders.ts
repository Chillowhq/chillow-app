export type OwnerOrderStatus = "placed" | "in_progress" | "ready" | "completed"
export type OwnerOrderPaymentStatus = "unpaid" | "pending" | "paid"
export type OwnerOrderType = "dine-in" | "takeout"

export interface OwnerOrderItem {
  itemName: string
  quantity: number
  lineTotal: number
  notes?: string
  allergies?: string[]
}

export interface OwnerOrder {
  orderId: string
  servicePointId: string
  servicePointLabel: string
  orderType: OwnerOrderType
  items: OwnerOrderItem[]
  total: number
  subtotal: number
  taxAmount: number
  platformFeeTotal: number
  currency?: string
  tipAmount?: number
  tipType?: "percentage" | "custom" | null
  tipPercentage?: number | null
  paymentStatus: OwnerOrderPaymentStatus
  status: OwnerOrderStatus
  createdAt: string
  readyAt?: string
  updatedAt?: string
  completedBy?: string | null
  receiptEmail?: string | null
}

export interface OwnerOrderCounts {
  placed: number
  in_progress: number
  ready: number
  completed: number
}

export interface OwnerOrdersPagination {
  limit: number
  nextCursor: string | null
  previousCursor: string | null
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface OwnerOrdersFilterOptions {
  orderTypes: OwnerOrderType[]
  paymentStatuses: OwnerOrderPaymentStatus[]
  servicePoints: Array<{ id: string; label: string }>
}

export interface OwnerOrdersResponse {
  orders: OwnerOrder[]
  counts: OwnerOrderCounts
  summary?: {
    totalOrders: number
    totalOrderValue: number
  }
  filterOptions?: OwnerOrdersFilterOptions
  pagination: OwnerOrdersPagination
}
