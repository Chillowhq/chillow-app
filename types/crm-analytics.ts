import type {
  AnalyticsDomainRange,
  OwnerAnalyticsCustomRange,
  OwnerAnalyticsRange,
} from "@/types/owner-analytics"

export type CrmAnalyticsRange = OwnerAnalyticsRange
export type CrmAnalyticsCustomRange = OwnerAnalyticsCustomRange

export type CrmMetricScope = "selectedPeriod" | "lifetimeCurrentState"

export type CrmAnalyticsCustomer = {
  guestId: string
  name: string
  email: string
  visitCount: number
  orderCount: number
  totalSpendCents: number
  lastVisitAt: string | null
  marketingConsent: boolean
}

export type CrmAnalyticsOverview = {
  totalCustomers: number
  activeCustomers: number
  newCustomers: number
  returningCustomers: number
  repeatCustomerRatePercent: number
  totalVisits: number
  averageVisitsPerCustomer: number
  customerRevenueCents: number
  paidOrderCount: number
  averageSpendPerCustomerCents: number
  averageSpendPerVisitCents: number
  marketingConsentCount: number
  marketingConsentPercent: number
  recentCustomerCount: number
  reEngagementCustomerCount: number
  dormantCustomerCount: number
}

export type CrmCustomerActivityPoint = {
  date: string
  newCustomers: number
  returningCustomers: number
}

export type CrmVisitPoint = {
  date: string
  visits: number
}

export type CrmSegment = {
  id: string
  label: string
  count: number
  scope: CrmMetricScope
}

export type CrmCustomerJourneyTrendPoint = {
  date: string
  orderingVisitors: number
  visitorsWhoOrdered: number
  identifiedVisitors: number
  anonymousOrderingVisitors: number
  journeyRevenueCents: number
}

export type CrmCustomerJourneyData = {
  totalOrderingVisitors: number
  visitorsWhoOrdered: number
  visitorsWithoutOrder: number
  identifiedVisitors: number
  anonymousOrderingVisitors: number
  identifiedOrderingVisitors: number
  visitToOrderConversionRate: number
  orderToIdentifiedConversionRate: number
  visitToIdentifiedConversionRate: number
  customerJourneyRevenueCents: number
  trend: CrmCustomerJourneyTrendPoint[]
  insights: string[]
  tracking: {
    hasTrackingData: boolean
    availableFrom: string | null
  }
}

export type CrmAnalyticsData = {
  contractVersion: 1
  range: AnalyticsDomainRange
  currency: string
  generatedAt: string
  metricScopes: Record<string, CrmMetricScope>
  overview: CrmAnalyticsOverview
  customerActivity: {
    bucket: "day" | "week" | "month"
    points: CrmCustomerActivityPoint[]
  }
  visits: {
    bucket: "day" | "week" | "month"
    points: CrmVisitPoint[]
  }
  segments: CrmSegment[]
  topCustomers: CrmAnalyticsCustomer[]
  reEngagement: {
    thresholdDays: number
    dormantThresholdDays: number
    customerCount: number
    dormantCustomerCount: number
    customers: CrmAnalyticsCustomer[]
  }
  customerJourney: CrmCustomerJourneyData
}
