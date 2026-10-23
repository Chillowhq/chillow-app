export type HousekeepingReadiness = "ready" | "needs_cleaning" | "cleaning"
export type HousekeepingSupplyOutcome = "pending" | "recorded" | "no_supplies_used" | "inventory_exception_acknowledged"
export type HousekeepingPriority = "normal" | "priority" | "urgent"

export type HousekeepingActorSnapshot = {
  staffId: string
  name: string | null
  role: string | null
}

export type HousekeepingInventoryException = {
  status: "unresolved" | "resolved"
  attemptedItems: Array<{ inventoryItemId: string; quantity: number; unit: string }>
  failureCode: string
  failureMessage: string
  reportedBy: HousekeepingActorSnapshot | null
  firstReportedAt: string
  lastReportedAt: string
  attemptCount: number
  acknowledgedBy: HousekeepingActorSnapshot | null
  acknowledgedAt: string | null
  resolvedBy: HousekeepingActorSnapshot | null
  resolvedAt: string | null
  reconciliationMovementIds: string[]
  resolutionNote: string | null
}

export type HousekeepingOperation = {
  housekeepingOperationId: string
  servicePointId: string
  servicePointLabel?: string
  operationType: "checkout_turnover"
  triggerType: "reservation_checkout"
  status: "needs_cleaning" | "cleaning" | "completed"
  active: boolean
  priority: HousekeepingPriority
  assignedTo: string | null
  assignedToName: string | null
  assignedToRole: string | null
  assignedAt: string | null
  assignedBy: string | null
  assignedByName: string | null
  assignedByRole: string | null
  assignmentHistory: Array<{
    action: "assigned" | "reassigned"
    previousAssignee: HousekeepingActorSnapshot | null
    assignee: HousekeepingActorSnapshot
    performedBy: HousekeepingActorSnapshot
    occurredAt: string
  }>
  claimedBy: string | null
  claimedByName: string | null
  claimedByRole: string | null
  startedAt: string | null
  completedBy: string | null
  completedByName: string | null
  completedByRole: string | null
  completedAt: string | null
  supplyOutcome: HousekeepingSupplyOutcome
  roomUsageOperationId: string | null
  inventoryException: HousekeepingInventoryException | null
  note: string | null
  createdAt: string
  updatedAt: string
  timing: {
    waitingSeconds: number | null
    cleaningSeconds: number | null
    waitingOverdue: boolean
    cleaningOverdue: boolean
  }
}

export type HousekeepingRoom = {
  servicePointId: string
  label: string
  roomType: string | null
  isActive: boolean
  readiness: HousekeepingReadiness
  operation: HousekeepingOperation | null
  allowedActions: {
    start: boolean
    serviceRoom: boolean
    noSuppliesUsed: boolean
    complete: boolean
  }
}

export type HousekeepingQueueResponse = {
  counts: Record<HousekeepingReadiness, number>
  overview: Record<HousekeepingReadiness, number> & {
    unassigned: number
    assignedNotStarted: number
    overdueWaiting: number
    overdueCleaning: number
    inventoryExceptions: number
    completedTurnovers: number
    averageTimeToStartSeconds: number | null
    averageCleaningDurationSeconds: number | null
    metricsWindowDays: number
    metricsTruncated: boolean
  }
  settings: HousekeepingSettings
  rooms: HousekeepingRoom[]
}

export type HousekeepingSettings = {
  targetStartMinutes: number | null
  targetCleaningMinutes: number | null
}

export type EligibleHousekeeper = {
  staffId: string
  name: string
  role: "housekeeping"
  accountStatus: "active"
}

export type HousekeepingHistoryResponse = {
  operations: HousekeepingOperation[]
  pagination: {
    limit: number
    hasNextPage: boolean
    nextCursor: string | null
  }
}
