export type DashboardSeverity = "error" | "warning" | "info"

export type HotelDashboardActionItem = {
  type: string
  severity: DashboardSeverity
  message: string
  href: string
}

export type HotelDashboardAccess = {
  reservations: boolean
  housekeeping: boolean
  transactions: boolean
  servicePoints: boolean
  staff: boolean
  billing: boolean
  foodService: boolean
}

export type HotelDashboardPayload = {
  dashboardType: "hotel"
  generatedAt: string
  businessDate: string
  timezone: string
  currency: string | null
  access: HotelDashboardAccess
  operations: {
    arrivals: { scheduled: number; checkedIn: number; remaining: number }
    departures: { scheduled: number; checkedOut: number; remaining: number }
    roomInventory: {
      eligibleRooms: number
      occupiedRooms: number
      notCurrentlyOccupiedRooms: number
    }
    overdueArrivals: number
    overdueDepartures: number
    activePendingPayments: number
  } | null
  housekeeping: {
    roomsNeedingCleaning: number
    urgentTasks: number
    unresolvedInventoryExceptions: number
  } | null
  financialSummary: {
    paidBookingRevenueCents: number
    paidBookingCount: number
    pendingReservationPaymentCount: number | null
  } | null
  foodService: {
    todayOrders: number | null
    activeOrders: number | null
    paidRevenueCents: number | null
  } | null
  businessHealth: {
    onlinePayments: "active" | "not_configured"
    billing: "active" | "past_due" | "incomplete"
  } | null
  actionItems: HotelDashboardActionItem[]
}
