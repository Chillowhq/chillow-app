import type { ServicePointType } from "@/types/business-capabilities"

export type OwnerAnalyticsRange =
  | "today"
  | "yesterday"
  | "7days"
  | "30days"
  | "thisMonth"
  | "custom"

export type AnalyticsModuleId = "foodService" | "lodging"

export type OwnerAnalyticsCustomRange = {
  from: string
  to: string
}

export type AnalyticsComparisonRange = {
  from: string
  to: string
  startUtc: string
  endUtcExclusive: string
}

export type AnalyticsResolvedRange = {
  preset: OwnerAnalyticsRange
  from: string
  to: string
  timezone: string
  startUtc: string
  endUtcExclusive: string
  comparison: AnalyticsComparisonRange
  foodOperationalRange: AnalyticsDomainRange
  lodgingCalendarRange: AnalyticsDomainRange
}

export type AnalyticsDomainRange = {
  preset: OwnerAnalyticsRange
  from: string
  to: string
  timezone: string
  startUtc: string
  endUtcExclusive: string
  comparison: AnalyticsComparisonRange
}

export type SharedPaidRevenue = {
  grossCents: number
  refundedCents: number
  netRetainedCents: number
  netToBusinessCents: number | null
  transactionCount: number
  averageTransactionValueCents: number
  comparisonPercent: number | null
}

export type SharedRevenueByDay = {
  date: string
  grossCents: number
  refundedCents: number
  netRetainedCents: number
  transactionCount: number
}

export type SharedRevenueByModule = {
  module: AnalyticsModuleId
  grossCents: number
  refundedCents: number
  netRetainedCents: number
  transactionCount: number
}

export type SharedAnalytics = {
  paidRevenue: SharedPaidRevenue
  revenueByDay: SharedRevenueByDay[]
  revenueByModule: SharedRevenueByModule[]
}

export type FoodServiceOverview = {
  paidRevenueCents: number
  activeOrders: number
  completedOrders: number
  averageOrderValueCents: number
  comparisonAverageOrderValueCents: number
  averageOrderValueComparisonPercent: number | null
  averagePrepTimeMinutes: number
  peakOrderHour: string | null
  totalItemsSold: number
}

export type FoodServiceTips = {
  totalTipsCents: number
  averageTipCents: number
  highestTipCents: number
  ordersWithTips: number
  tipRatePercent: number
}

export type FoodServiceRevenueByDay = {
  date: string
  grossCents: number
  orderCount: number
}

export type FoodServiceHourlyOrders = {
  hour: string
  orderCount: number
  paidRevenueCents: number
}

export type FoodServiceTopItem = {
  itemName: string
  quantity: number
  paidItemRevenueCents: number
  category: string
}

export type FoodServiceCategoryPerformance = {
  category: string
  quantity: number
  paidItemRevenueCents: number
  percentageOfItemRevenue: number
}

export type FoodServiceOrderTypeBreakdown = {
  type: "dine-in" | "takeout"
  orderCount: number
  paidRevenueCents: number
  orderPercentage: number
  revenuePercentage: number
}

export type FoodServiceChannelBreakdown = {
  channel: "self" | "waitstaff"
  label: string
  orderCount: number
  paidRevenueCents: number
  orderPercentage: number
  revenuePercentage: number
}

export type ServiceRequestsByReason = {
  request_bill: number
  assistance: number
  emergency: number
  other: number
}

export type FoodServiceRequests = {
  total: number
  pending: number
  acknowledged: number
  resolved: number
  missed: number
  byReason: ServiceRequestsByReason
  averageResponseTimeSeconds: number
  averageResolutionTimeSeconds: number
}

export type ServicePointPerformanceItem = {
  servicePointId: string
  label: string
  code: string
  servicePointType: ServicePointType
  orderCount: number
  paidRevenueCents: number
  averagePaidOrderValueCents: number
  paidOrders: number
  unpaidOrders: number
}

export type StaffPerformanceItem = {
  staffId: string
  name: string
  callsAcknowledged: number
  callsResolved: number
  averageResponseTimeSeconds: number
  averageResolutionTimeSeconds: number
  ordersServed: number
  paymentsConfirmed: number
  totalOfflinePaymentsConfirmedCents: number
}

export type FoodServiceAnalyticsModule = {
  overview: FoodServiceOverview
  tips: FoodServiceTips
  revenueByDay: FoodServiceRevenueByDay[]
  hourlyOrders: FoodServiceHourlyOrders[]
  topItems: FoodServiceTopItem[]
  categoryPerformance: FoodServiceCategoryPerformance[]
  categoryRevenueBasis: "paidItemRevenue"
  orderTypeBreakdown: FoodServiceOrderTypeBreakdown[]
  channelBreakdown: FoodServiceChannelBreakdown[]
  serviceRequests: FoodServiceRequests
  servicePointPerformance: ServicePointPerformanceItem[]
  staffPerformance: StaffPerformanceItem[]
}

export type LodgingOverview = {
  paidBookingRevenueCents: number
  refundedBookingRevenueCents: number
  netRetainedBookingRevenueCents: number
  paidBookingRevenueComparisonPercent: number | null
  paidBookingCount: number
  averageBookingValueCents: number
  averageBookingValueComparisonPercent: number | null
  averageLengthOfStayNights: number
  scheduledArrivals: number
  scheduledDepartures: number
  actualCheckIns: number
  pendingPaymentCount: number
  pendingPaymentValueCents: number
}

export type LodgingBookingRevenueByDay = {
  date: string
  grossCents: number
  refundedCents: number
  netRetainedCents: number
  bookingCount: number
}

export type LodgingBookingTrend = {
  date: string
  bookingCount: number
}

export type LodgingReservationStatusBreakdown = {
  status: string
  count: number
  percentagePercent: number
}

export type LodgingPaymentStatusBreakdown = {
  status: string
  count: number
  percentagePercent: number
}

export type LodgingBookingSourceBreakdown = {
  source: string
  count: number
  percentagePercent: number
}

export type LodgingRoomRevenuePerformance = {
  servicePointId: string
  label: string
  code: string
  paidBookingCount: number
  paidRevenueCents: number
  averageBookingValueCents: number
  totalNights: number
}

export type LodgingArrivals = {
  scheduled: number
  checkedIn: number
  pending: number
}

export type LodgingDepartures = {
  scheduled: number
}

export type LodgingPendingPayments = {
  activeCount: number
  expiredCount: number
  activeValueCents: number
  expiredValueCents: number
  snapshotAt: string
}

export type LodgingOccupancy = {
  occupiedRoomNights: number
  availableRoomNights: number
  occupancyRatePercent: number | null
  occupiedRoomsForToday: number
  availableRoomsForToday: number
}

export type LodgingLifecycleMetric = {
  count: number
  comparisonPercent: number | null
}

export type LodgingLifecycleSummary = {
  confirmations: LodgingLifecycleMetric
  cancellations: LodgingLifecycleMetric & {
    cancelledBookingCohortRatePercent: number | null
  }
  checkouts: {
    actualCount: number
    scheduledCount: number
    completedScheduledCount: number
    completionRatePercent: number | null
  }
}

export type LodgingEventTrendPoint = {
  date: string
  count: number
}

export type LodgingCancellationReason = {
  reason: string
  count: number
  percentagePercent: number
}

export type LodgingRoomTypePerformance = {
  roomType: string
  roomCount: number
  paidBookingCount: number
  bookedNights: number
  paidRevenueCents: number
  averageBookingValueCents: number
  occupancyRatePercent: number | null
}

export type LodgingCheckInStaffPerformance = {
  staffId: string
  name: string
  checkInsCompleted: number
  percentagePercent: number
  averageCheckInDelayMinutes: number | null
}

export type LodgingCheckOutStaffPerformance = {
  staffId: string
  name: string
  checkOutsCompleted: number
  percentagePercent: number
  averageCheckoutDelayMinutes: number | null
}

export type LodgingStaffAttribution = {
  unattributedCheckIns: number
  unattributedCheckOuts: number
}

export type LodgingAnalyticsModule = {
  overview: LodgingOverview
  bookingRevenueByDay: LodgingBookingRevenueByDay[]
  bookingTrend: LodgingBookingTrend[]
  reservationStatusBreakdown: LodgingReservationStatusBreakdown[]
  paymentStatusBreakdown: LodgingPaymentStatusBreakdown[]
  bookingSourceBreakdown: LodgingBookingSourceBreakdown[]
  roomRevenuePerformance: LodgingRoomRevenuePerformance[]
  arrivals: LodgingArrivals
  departures: LodgingDepartures
  pendingPayments: LodgingPendingPayments
  occupancy: LodgingOccupancy
  lifecycle: LodgingLifecycleSummary
  confirmationTrend: LodgingEventTrendPoint[]
  cancellationTrend: LodgingEventTrendPoint[]
  cancellationReasonBreakdown: LodgingCancellationReason[]
  checkoutTrend: LodgingEventTrendPoint[]
  roomTypePerformance: LodgingRoomTypePerformance[]
  checkInStaffPerformance: LodgingCheckInStaffPerformance[]
  checkOutStaffPerformance: LodgingCheckOutStaffPerformance[]
  staffAttribution: LodgingStaffAttribution
}

export type OwnerAnalyticsData = {
  contractVersion: 2
  range: AnalyticsResolvedRange
  currency: string
  generatedAt: string
  enabledAnalyticsModules: AnalyticsModuleId[]
  shared?: SharedAnalytics
  modules: {
    foodService?: FoodServiceAnalyticsModule
    lodging?: LodgingAnalyticsModule
  }
}
