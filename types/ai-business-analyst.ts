// Types for the AI Business Analyst feature ( Mayor).
// Mirrors the backend DTO from GET /owner/ai-business-analyst/*

export type AnalystReportStatus =
  | "not_generated"
  | "snapshot_ready"
  | "generating"
  | "completed"
  | "failed"

export type BusinessHealthV5Entry = {
  area: string
  status: string
  explanation: string
}

export type MayorPriorityV5 = {
  rank: number
  title: string
  finding: string
  evidence: string
  whyItMatters: string
  possibleExplanations: string
  recommendedAction: string
  watchNextWeek: string | null
}

export type MayorWorkingWellV5 = {
  title: string
  explanation: string
}

export type MayorOpportunityV5 = {
  title: string
  evidence: string
  recommendation: string
}

export type MayorWatchItemV5 = {
  title: string
  reason: string
  metric: string | null
}

export type GeneratedAnalystReportV5 = {
  reportVersion?: string
  headline: string
  executiveSummary: string
  businessHealth: BusinessHealthV5Entry[]
  priorities: MayorPriorityV5[]
  workingWell: MayorWorkingWellV5[]
  opportunities: MayorOpportunityV5[]
  watchNextWeek: MayorWatchItemV5[]
}

export type GeneratedAnalystReport = GeneratedAnalystReportV5

export type AnalystReportPeriod = {
  key: string
  start: string
  end: string
  previousStart: string
  previousEnd: string
  timezone: string
}

export type AnalystReport = {
  period: AnalystReportPeriod
  status: AnalystReportStatus
  snapshotVersion: number
  insightEngineVersion: number
  deterministicInsights: {
    insights: Array<{
      id: string
      category: string
      type: string
      messageKey: string
      priority: string
      impact: string
      confidence: string
      priorityScore: number
      evidence: Record<string, unknown>
    }>
    dominantSignal?: {
      id: string
      category: string
      type: string
      priorityScore: number
    } | null
    crossDomainSignals?: Array<{
      id: string
      categories: string[]
      relationship: string
      periodAligned: boolean
      signalIds: string[]
    }>
    insufficientData: boolean
    noSignificantInsights: boolean
  } | null
  generatedReport: GeneratedAnalystReport | null
  generatedAt: string | null
  modelProvider?: string | null
  modelVersion?: string | null
  promptVersion?: string | null
  reportVersion?: string | null
  aiUsage?: {
    inputTokens: number | null
    outputTokens: number | null
    totalTokens: number | null
  } | null
}

// Updated /latest response with temporal metadata

export type WeekMetadata = {
  periodKey: string
  periodStart: string
  periodEnd: string
}

export type CurrentWeekMetadata = WeekMetadata & {
  dataThrough: string
  isLive: true
}

export type LatestReportResponse = {
  report: AnalystReport | null
  status: "not_generated" | "available"
  businessTimezone: string
  currentWeek: CurrentWeekMetadata
  latestCompletedWeek: WeekMetadata
  expectedFinalPeriodKey: string
  isLatestFinalMissing: boolean
}

// History

export type AnalystHistoryEntry = {
  periodKey: string
  periodStart: string
  periodEnd: string
  generationStatus: AnalystReportStatus
  generatedAt: string | null
  hasReport: boolean
}

export type AnalystHistoryResponse = {
  reports: AnalystHistoryEntry[]
}

export type SpecificReportResponse = {
  report: AnalystReport
}

// Current-week live snapshot

export type CurrentWeekSnapshotResponse = {
  isLive: true
  dataThrough: string
  period: {
    key: string
    start: string
    end: string
    previousStart: string
    previousEnd: string
    timezone: string
    dataThrough?: string
  }
  business: {
    businessType: string
    currency: string
    modules: string[]
  }
  sales: {
    paidRevenueCents: number
    previousPaidRevenueCents: number
    revenueChangePercent: number | null
    transactionCount: number
    previousTransactionCount: number
    transactionCountChangePercent: number | null
    averageTransactionValueCents: number
    previousAverageTransactionValueCents: number
    revenueByDay: Array<{ date: string; grossCents: number; transactionCount: number }>
  }
  operations: {
    completedOrders: number
    previousCompletedOrders: number
    completedOrdersChangePercent: number | null
    averagePrepTimeMinutes: number
    previousAveragePrepTimeMinutes: number
    prepTimeChangePercent: number | null
    totalItemsSold: number
    previousTotalItemsSold: number
    itemsSoldChangePercent: number | null
  } | null
  customers: {
    newCustomers: number
    previousNewCustomers: number
    newCustomersChangePercent: number | null
    returningCustomers: number
    previousReturningCustomers: number
    returningCustomersChangePercent: number | null
    distinctVisitors: number
    previousDistinctVisitors: number
    totalVisits: number
    previousTotalVisits: number
  }
  deterministicInsights: {
    insights: Array<{
      id: string
      category: string
      type: string
      messageKey: string
      priority: string
      impact: string
      confidence: string
      priorityScore: number
      evidence: Record<string, unknown>
    }>
    dominantSignal?: {
      id: string
      category: string
      type: string
      priorityScore: number
    } | null
    crossDomainSignals?: Array<{
      id: string
      categories: string[]
      relationship: string
      periodAligned: boolean
      signalIds: string[]
    }>
    insufficientData: boolean
    noSignificantInsights: boolean
  }
  menu?: unknown
  service?: unknown
  servicePoints?: unknown
  staff?: unknown
  feedback?: {
    current: {
      reviewCount: number
      averageRating: number | null
      ratingDistribution: Record<string, number>
      lowRatingCount: number
      highRatingCount: number
      writtenCommentCount: number
      lowRatingRatePercent: number | null
      highRatingRatePercent: number | null
      csatPercent: number | null
      orderTypeBreakdown: Array<{
        orderType: string
        reviewCount: number
        averageRating: number | null
      }>
    }
    previous: {
      reviewCount: number
      averageRating: number | null
      lowRatingCount: number
      highRatingCount: number
      lowRatingRatePercent: number | null
      highRatingRatePercent: number | null
      csatPercent: number | null
    }
    comparison: {
      ratingDelta: number | null
      reviewCountDelta: number
      lowRatingRateDeltaPoints: number | null
      highRatingRateDeltaPoints: number | null
      csatDeltaPoints: number | null
    }
  }
  inventory?: {
    stockHealthAsOf: {
      asOf: string
      periodAligned: boolean
      activeItems?: number
      lowStockItems?: number
      outOfStockItems?: number
      mostUrgentItems?: Array<{
        itemName: string
        availableQuantity: number
        lowStockThreshold: number
        unit: string
        status: "low_stock" | "out_of_stock"
      }>
    }
    current: {
      totalMovementCount: number
      countsByType: Record<string, number>
      ingredientShortages: {
        eventCount: number
        affectedItemCount: number
      }
    }
    previous: {
      totalMovementCount: number
      countsByType: Record<string, number>
      ingredientShortages: {
        eventCount: number
        affectedItemCount: number
      }
    }
    comparison: Record<string, number>
    tracking: {
      asOf: string
      periodAligned: boolean
    }
  }
  reservations?: unknown
  tipsPayments?: unknown
}

// Period selector item

export type PeriodSelectorItem = {
  periodKey: string
  periodStart: string
  periodEnd: string
  label: string
  badge: "live" | "final" | "unavailable" | "generating"
  isCurrentWeek: boolean
  isSelectable: boolean
}
