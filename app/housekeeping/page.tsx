"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpDown,
  BedDouble,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Eye,
  History,
  Loader2,
  LogOut,
  PackageCheck,
  Play,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  UserRoundCheck,
} from "lucide-react"
import { toast } from "sonner"

import { RoomUsageDialog } from "@/components/owner/inventory/RoomUsageDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useEventSource } from "@/hooks/use-event-source"
import { apiClient } from "@/lib/axios-config"
import { hasManagementPermission, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { cn } from "@/lib/utils"
import type {
  EligibleHousekeeper,
  HousekeepingHistoryResponse,
  HousekeepingOperation,
  HousekeepingPriority,
  HousekeepingQueueResponse,
  HousekeepingReadiness,
  HousekeepingRoom,
  HousekeepingSettings,
} from "@/types/housekeeping"

type QueueScope = "my" | "unassigned" | "all"
type QueueSort = "priority" | "waiting" | "room"
type QueueStatusView = HousekeepingReadiness | "urgent"
type QueueFilters = {
  priorities: HousekeepingPriority[]
  roomType: string
}

const STATUS_TABS: Array<{ value: QueueStatusView; label: string }> = [
  { value: "needs_cleaning", label: "Needs Cleaning" },
  { value: "cleaning", label: "In Progress" },
  { value: "urgent", label: "Urgent" },
  { value: "ready", label: "Ready" },
]

const PRIORITY_LABELS: Record<HousekeepingPriority, string> = {
  normal: "Normal",
  priority: "Priority",
  urgent: "Urgent",
}

const EMPTY_FILTERS: QueueFilters = { priorities: [], roomType: "all" }

function requestError(error: unknown, fallback: string) {
  const response = (error as {
    response?: { data?: { error?: string; message?: string }; status?: number }
  })?.response
  return {
    message: response?.data?.error || response?.data?.message || fallback,
    status: response?.status,
  }
}

function formatDateTime(value: string | null | undefined, timezone: string) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not recorded"
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date)
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "Not available"
  if (seconds < 60) return "Under 1 min"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function readinessPresentation(readiness: HousekeepingReadiness) {
  if (readiness === "needs_cleaning") {
    return { label: "Needs Cleaning", classes: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 }
  }
  if (readiness === "cleaning") {
    return { label: "In Progress", classes: "border-blue-200 bg-blue-50 text-blue-700", icon: Sparkles }
  }
  return { label: "Ready", classes: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 }
}

function priorityClasses(priority: HousekeepingPriority) {
  if (priority === "urgent") return "border-red-200 bg-red-50 text-red-700"
  if (priority === "priority") return "border-orange-200 bg-orange-50 text-orange-700"
  return "border-slate-200 bg-slate-50 text-slate-600"
}

function matchesStatusView(room: HousekeepingRoom, statusView: QueueStatusView) {
  if (statusView === "urgent") return room.operation?.priority === "urgent"
  return room.readiness === statusView
}

function isUnassignedRoom(room: HousekeepingRoom) {
  return Boolean(
    room.operation?.active &&
    !room.operation.assignedTo &&
    !room.operation.claimedBy,
  )
}

function emptyRoomsMessage(statusView: QueueStatusView, scope: QueueScope) {
  if (statusView === "needs_cleaning") {
    if (scope === "my") return "No rooms assigned to you need cleaning."
    if (scope === "unassigned") return "No unassigned rooms need cleaning."
    return "No rooms currently need cleaning."
  }
  if (statusView === "cleaning") {
    if (scope === "my") return "You don't have any rooms in progress."
    if (scope === "unassigned") return "No unassigned rooms are in progress."
    return "No rooms are currently in progress."
  }
  if (statusView === "urgent") {
    if (scope === "my") return "No urgent rooms are assigned to you."
    if (scope === "unassigned") return "No unassigned urgent rooms right now."
    return "No urgent rooms right now."
  }
  if (scope === "my") return "No rooms assigned to you are currently ready."
  if (scope === "unassigned") return "No unassigned rooms are currently ready."
  return "No rooms are currently ready."
}

function commandKey(prefix: string, operationId: string) {
  return `${prefix}:${operationId}:${crypto.randomUUID()}`
}

function StatusBadge({ readiness }: { readiness: HousekeepingReadiness }) {
  const presentation = readinessPresentation(readiness)
  const Icon = presentation.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold", presentation.classes)}>
      <Icon className="size-3" aria-hidden="true" />
      {presentation.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: HousekeepingPriority }) {
  if (priority === "normal") return null
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold", priorityClasses(priority))}>
      {priority === "urgent" ? <AlertTriangle className="size-3" aria-hidden="true" /> : null}
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

function RoomIdentity({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-[#FFF0E7] text-[#E94F0B]", compact ? "size-9" : "size-12")} aria-hidden="true">
      <BedDouble className={compact ? "size-4" : "size-5"} />
    </span>
  )
}

function assignmentLabel(room: HousekeepingRoom, staffId?: string) {
  const operation = room.operation
  if (!operation) return "Unassigned"
  if (operation.status === "cleaning" && operation.claimedBy) {
    return operation.claimedBy === staffId ? "You" : operation.claimedByName || "Assigned staff"
  }
  if (!operation.assignedTo) return "Unassigned"
  return operation.assignedTo === staffId ? "You" : operation.assignedToName || "Assigned staff"
}

function elapsedLabel(room: HousekeepingRoom) {
  const operation = room.operation
  if (!operation) return "No active turnover"
  if (operation.status === "needs_cleaning") return `${operation.timing.waitingOverdue ? "Overdue waiting" : "Waiting"} ${formatDuration(operation.timing.waitingSeconds)}`
  if (operation.status === "cleaning") return `${operation.timing.cleaningOverdue ? "Overdue cleaning" : "Cleaning"} ${formatDuration(operation.timing.cleaningSeconds)}`
  return `Ready ${formatDuration(operation.timing.cleaningSeconds)}`
}

function supplyLabel(operation: HousekeepingOperation) {
  if (operation.supplyOutcome === "recorded") return "Supplies recorded"
  if (operation.supplyOutcome === "no_supplies_used") return "No supplies used"
  if (operation.supplyOutcome === "inventory_exception_acknowledged") return "Inventory exception acknowledged"
  return "Supply confirmation required"
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  value: number
  tone: "orange" | "blue" | "green" | "red"
  icon: typeof Clock3
  active: boolean
  onClick: () => void
}) {
  const tones = {
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
  }
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group flex min-h-20 items-center gap-2 rounded-2xl border bg-white px-2.5 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45B0B] sm:min-h-24 sm:gap-3 sm:px-4",
        active ? "border-[#F45B0B] ring-1 ring-[#F45B0B]/20" : "border-[#E8E4E0]",
      )}
    >
      <span className={cn("hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex lg:size-12", tones[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-black leading-none text-[#0A214A] sm:text-2xl">{value}</span>
        <span className="mt-1 block text-[10px] font-bold leading-tight text-[#33466A] sm:text-xs">{label}</span>
      </span>
    </button>
  )
}

export default function HousekeepingPage() {
  const { user, loading: authLoading, logout } = useAuthGuard({
    allowedRoles: ["housekeeping", "owner", "co_owner", "manager", "admin"],
    requiredPermission: MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW,
  })
  const [queue, setQueue] = useState<HousekeepingQueueResponse | null>(null)
  const [workspaceTab, setWorkspaceTab] = useState<"queue" | "history">("queue")
  const [scope, setScope] = useState<QueueScope | null>(null)
  const [statusView, setStatusView] = useState<QueueStatusView>("needs_cleaning")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<QueueSort>("priority")
  const [filters, setFilters] = useState<QueueFilters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyOperationId, setBusyOperationId] = useState<string | null>(null)
  const [serviceRoom, setServiceRoom] = useState<HousekeepingRoom | null>(null)
  const [detailsRoomId, setDetailsRoomId] = useState<string | null>(null)
  const [claimRoomId, setClaimRoomId] = useState<string | null>(null)
  const [completionRoomId, setCompletionRoomId] = useState<string | null>(null)
  const [assignRoom, setAssignRoom] = useState<HousekeepingRoom | null>(null)
  const [selectedAssignee, setSelectedAssignee] = useState("")
  const [eligibleStaff, setEligibleStaff] = useState<EligibleHousekeeper[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState({ targetStartMinutes: "", targetCleaningMinutes: "" })
  const [history, setHistory] = useState<HousekeepingOperation[]>([])
  const [historyCursor, setHistoryCursor] = useState<string | null>(null)
  const [historyHasNext, setHistoryHasNext] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRoom, setHistoryRoom] = useState("all")
  const [historyStaff, setHistoryStaff] = useState("all")
  const [resolveOperation, setResolveOperation] = useState<HousekeepingOperation | null>(null)
  const [resolutionMovementIds, setResolutionMovementIds] = useState("")

  const lodgingEnabled = Boolean(user?.capabilities?.visibleModules.includes("lodging"))
  const canAssign = hasManagementPermission(user, MANAGER_PERMISSIONS.HOUSEKEEPING_ASSIGN)
  const canManage = hasManagementPermission(user, MANAGER_PERMISSIONS.HOUSEKEEPING_MANAGE)
  const isManagement = canAssign || canManage
  const effectiveScope: QueueScope = scope || (isManagement ? "all" : "my")
  const timezone = user?.timezone || "UTC"

  const loadQueue = useCallback(async () => {
    if (!user || !lodgingEnabled) return
    try {
      setError(null)
      const response = await apiClient.get<HousekeepingQueueResponse>("/housekeeping/rooms")
      setQueue(response.data)
    } catch (requestFailure) {
      setError(requestError(requestFailure, "Housekeeping rooms could not be loaded").message)
    } finally {
      setLoading(false)
    }
  }, [lodgingEnabled, user])

  const loadEligibleStaff = useCallback(async () => {
    if (!canAssign) return
    try {
      const response = await apiClient.get<{ staff: EligibleHousekeeper[] }>("/housekeeping/eligible-staff")
      setEligibleStaff(response.data.staff)
    } catch (requestFailure) {
      toast.error(requestError(requestFailure, "Eligible Housekeeping staff could not be loaded").message)
    }
  }, [canAssign])

  const loadHistory = useCallback(async ({ cursor = null, append = false }: { cursor?: string | null; append?: boolean } = {}) => {
    if (!isManagement) return
    setHistoryLoading(true)
    try {
      const response = await apiClient.get<HousekeepingHistoryResponse>("/housekeeping/history", {
        params: {
          cursor: cursor || undefined,
          limit: 20,
          servicePointId: historyRoom === "all" ? undefined : historyRoom,
          staffId: historyStaff === "all" ? undefined : historyStaff,
        },
      })
      setHistory((current) => append ? [...current, ...response.data.operations] : response.data.operations)
      setHistoryCursor(response.data.pagination.nextCursor)
      setHistoryHasNext(response.data.pagination.hasNextPage)
    } catch (requestFailure) {
      toast.error(requestError(requestFailure, "Housekeeping history could not be loaded").message)
    } finally {
      setHistoryLoading(false)
    }
  }, [historyRoom, historyStaff, isManagement])

  const realtimeHandlers = useMemo(() => ({
    housekeeping_changed: () => {
      void loadQueue()
      if (workspaceTab === "history" && isManagement) void loadHistory()
    },
  }), [isManagement, loadHistory, loadQueue, workspaceTab])

  useEffect(() => {
    if (user && lodgingEnabled) void loadQueue()
  }, [loadQueue, lodgingEnabled, user])

  useEffect(() => {
    if (canAssign) void loadEligibleStaff()
  }, [canAssign, loadEligibleStaff])

  useEffect(() => {
    if (workspaceTab === "history" && isManagement) void loadHistory()
  }, [historyRoom, historyStaff, isManagement, loadHistory, workspaceTab])

  useEffect(() => {
    if (!queue?.settings) return
    setSettingsDraft({
      targetStartMinutes: queue.settings.targetStartMinutes?.toString() || "",
      targetCleaningMinutes: queue.settings.targetCleaningMinutes?.toString() || "",
    })
  }, [queue?.settings])

  useEventSource(
    user && lodgingEnabled
      ? `/events?businessId=${encodeURIComponent(user.businessId)}&role=housekeeping&permission=${encodeURIComponent(MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW)}`
      : "",
    realtimeHandlers,
    { onOpen: loadQueue, onReconnect: loadQueue, recoverOnVisibility: true },
  )

  const runAction = async (room: HousekeepingRoom, action: "start" | "no-supplies" | "complete") => {
    const operationId = room.operation?.housekeepingOperationId
    if (!operationId) return false
    setBusyOperationId(operationId)
    try {
      await apiClient.post(`/housekeeping/operations/${encodeURIComponent(operationId)}/${action}`)
      toast.success(action === "start" ? `Cleaning started for ${room.label}` : action === "complete" ? `${room.label} is ready` : "No supplies used recorded")
      await loadQueue()
      return true
    } catch (requestFailure) {
      const result = requestError(requestFailure, "Housekeeping action could not be completed")
      toast.error(result.status === 409 ? "This room changed while you were working. The latest state has been loaded." : result.message)
      if (result.status === 409) await loadQueue()
      return false
    } finally {
      setBusyOperationId(null)
    }
  }

  const saveAssignment = async () => {
    const operation = assignRoom?.operation
    if (!operation || !selectedAssignee) return
    setBusyOperationId(operation.housekeepingOperationId)
    try {
      await apiClient.put(
        `/housekeeping/operations/${encodeURIComponent(operation.housekeepingOperationId)}/assignment`,
        { assigneeStaffId: selectedAssignee, expectedAssignedTo: operation.assignedTo },
        { headers: { "Idempotency-Key": commandKey("assignment", operation.housekeepingOperationId) } },
      )
      toast.success(operation.assignedTo ? "Room reassigned" : "Room assigned")
      setAssignRoom(null)
      setSelectedAssignee("")
      await loadQueue()
    } catch (requestFailure) {
      const result = requestError(requestFailure, "Assignment could not be saved")
      toast.error(result.status === 409 ? "This assignment changed. The latest state has been loaded." : result.message)
      if (result.status === 409) {
        setAssignRoom(null)
        await loadQueue()
      }
    } finally {
      setBusyOperationId(null)
    }
  }

  const setPriority = async (operation: HousekeepingOperation, priority: HousekeepingPriority) => {
    setBusyOperationId(operation.housekeepingOperationId)
    try {
      await apiClient.put(
        `/housekeeping/operations/${encodeURIComponent(operation.housekeepingOperationId)}/priority`,
        { priority, expectedPriority: operation.priority },
        { headers: { "Idempotency-Key": commandKey("priority", operation.housekeepingOperationId) } },
      )
      await loadQueue()
    } catch (requestFailure) {
      const result = requestError(requestFailure, "Priority could not be changed")
      toast.error(result.status === 409 ? "This priority changed. The latest state has been loaded." : result.message)
      if (result.status === 409) await loadQueue()
    } finally {
      setBusyOperationId(null)
    }
  }

  const acknowledgeException = async (operation: HousekeepingOperation) => {
    setBusyOperationId(operation.housekeepingOperationId)
    try {
      await apiClient.post(
        `/housekeeping/operations/${encodeURIComponent(operation.housekeepingOperationId)}/inventory-exception/acknowledge`,
        {},
        { headers: { "Idempotency-Key": commandKey("exception-ack", operation.housekeepingOperationId) } },
      )
      toast.success("Inventory discrepancy acknowledged. The room can now be completed.")
      await loadQueue()
    } catch (requestFailure) {
      toast.error(requestError(requestFailure, "Inventory exception could not be acknowledged").message)
    } finally {
      setBusyOperationId(null)
    }
  }

  const resolveException = async () => {
    if (!resolveOperation) return
    const movementIds = resolutionMovementIds.split(",").map((value) => value.trim()).filter(Boolean)
    if (!movementIds.length) {
      toast.error("Enter at least one canonical Inventory movement ID")
      return
    }
    setBusyOperationId(resolveOperation.housekeepingOperationId)
    try {
      await apiClient.post(
        `/housekeeping/operations/${encodeURIComponent(resolveOperation.housekeepingOperationId)}/inventory-exception/resolve`,
        { movementIds },
        { headers: { "Idempotency-Key": commandKey("exception-resolve", resolveOperation.housekeepingOperationId) } },
      )
      toast.success("Inventory discrepancy marked reconciled")
      setResolveOperation(null)
      setResolutionMovementIds("")
      await loadQueue()
      if (workspaceTab === "history") await loadHistory()
    } catch (requestFailure) {
      toast.error(requestError(requestFailure, "Inventory reconciliation could not be verified").message)
    } finally {
      setBusyOperationId(null)
    }
  }

  const saveSettings = async () => {
    try {
      const payload: HousekeepingSettings = {
        targetStartMinutes: settingsDraft.targetStartMinutes ? Number(settingsDraft.targetStartMinutes) : null,
        targetCleaningMinutes: settingsDraft.targetCleaningMinutes ? Number(settingsDraft.targetCleaningMinutes) : null,
      }
      await apiClient.put("/housekeeping/settings", payload)
      toast.success("Housekeeping targets saved")
      setSettingsOpen(false)
      await loadQueue()
    } catch (requestFailure) {
      toast.error(requestError(requestFailure, "Housekeeping targets could not be saved").message)
    }
  }

  const allRooms = useMemo(() => queue?.rooms || [], [queue?.rooms])
  const detailsRoom = allRooms.find((room) => room.servicePointId === detailsRoomId) || null
  const claimRoom = allRooms.find((room) => room.servicePointId === claimRoomId) || null
  const completionRoom = allRooms.find((room) => room.servicePointId === completionRoomId) || null
  const roomTypes = useMemo(() => [...new Set(allRooms.map((room) => room.roomType).filter((value): value is string => Boolean(value)))].sort(), [allRooms])
  const urgentCount = allRooms.filter((room) => room.operation?.active && room.operation.priority === "urgent").length
  const currentCleaning = allRooms.find((room) => room.readiness === "cleaning" && (room.operation?.claimedBy === user?.staffId || room.operation?.assignedTo === user?.staffId))
    || (isManagement ? allRooms.find((room) => room.readiness === "cleaning") : undefined)

  const scopeCounts = useMemo(() => ({
    my: allRooms.filter((room) => {
      const operation = room.operation
      return Boolean(user && (operation?.assignedTo === user.staffId || operation?.claimedBy === user.staffId))
    }).length,
    unassigned: allRooms.filter(isUnassignedRoom).length,
    all: allRooms.length,
  }), [allRooms, user])

  const visibleRooms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const scoped = allRooms.filter((room) => {
      if (!matchesStatusView(room, statusView)) return false
      if (effectiveScope === "my") return room.operation?.assignedTo === user?.staffId || room.operation?.claimedBy === user?.staffId
      if (effectiveScope === "unassigned") return isUnassignedRoom(room)
      return true
    })
    const filtered = scoped.filter((room) => {
      if (normalizedQuery && !`${room.label} ${room.roomType || ""}`.toLowerCase().includes(normalizedQuery)) return false
      if (filters.priorities.length && (!room.operation || !filters.priorities.includes(room.operation.priority))) return false
      if (filters.roomType !== "all" && room.roomType !== filters.roomType) return false
      return true
    })
    if (sort === "priority") return filtered
    return [...filtered].sort((left, right) => {
      if (sort === "room") return left.label.localeCompare(right.label, undefined, { numeric: true })
      const leftSeconds = left.operation?.status === "cleaning" ? left.operation.timing.cleaningSeconds : left.operation?.timing.waitingSeconds
      const rightSeconds = right.operation?.status === "cleaning" ? right.operation.timing.cleaningSeconds : right.operation?.timing.waitingSeconds
      return (rightSeconds || 0) - (leftSeconds || 0)
    })
  }, [allRooms, effectiveScope, filters, query, sort, statusView, user?.staffId])

  const activeFilterCount = filters.priorities.length + (filters.roomType === "all" ? 0 : 1)
  const hasNotes = visibleRooms.some((room) => Boolean(room.operation?.note?.trim()))
  const statusCounts: Record<QueueStatusView, number> = {
    needs_cleaning: queue?.counts.needs_cleaning || 0,
    cleaning: queue?.counts.cleaning || 0,
    urgent: urgentCount,
    ready: queue?.counts.ready || 0,
  }

  const selectStatusView = (nextStatus: QueueStatusView) => {
    setStatusView(nextStatus)
    if (nextStatus === "urgent") {
      setFilters((current) => current.priorities.length ? { ...current, priorities: [] } : current)
    }
  }

  const isAssignmentAction = (room: HousekeepingRoom) => (
    canAssign && room.operation?.status === "needs_cleaning"
  )

  const openAssignment = (room: HousekeepingRoom) => {
    setAssignRoom(room)
    setSelectedAssignee(room.operation?.assignedTo || "")
  }

  const openPrimaryAction = (room: HousekeepingRoom) => {
    if (isAssignmentAction(room)) {
      openAssignment(room)
      return
    }
    if (room.allowedActions.start) {
      if (!room.operation?.assignedTo) setClaimRoomId(room.servicePointId)
      else void runAction(room, "start")
      return
    }
    if (room.allowedActions.serviceRoom || room.allowedActions.noSuppliesUsed || room.allowedActions.complete) {
      setCompletionRoomId(room.servicePointId)
      return
    }
    setDetailsRoomId(room.servicePointId)
  }

  const actionLabel = (room: HousekeepingRoom) => {
    if (isAssignmentAction(room)) return room.operation?.assignedTo ? "Reassign" : "Assign"
    if (room.allowedActions.start) return room.operation?.assignedTo ? "Start Cleaning" : "Claim"
    if (room.allowedActions.serviceRoom || room.allowedActions.noSuppliesUsed || room.allowedActions.complete) return "Finish Cleaning"
    return "View"
  }

  if (authLoading || (user && lodgingEnabled && loading && !queue)) {
    return <div className="flex min-h-dvh items-center justify-center bg-[#FBFAF8]"><Loader2 className="size-7 animate-spin text-[#F45B0B]" aria-label="Loading Housekeeping" /></div>
  }
  if (!user) return null
  if (!lodgingEnabled) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#FBFAF8] p-6">
        <div className="max-w-sm rounded-3xl border bg-white p-6 text-center shadow-sm">
          <BedDouble className="mx-auto size-9 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-black">Housekeeping unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">This workspace requires the Lodging capability.</p>
          {user.role !== "housekeeping" ? <Button asChild className="mt-5"><Link href="/owner/dashboard">Return to Owner Portal</Link></Button> : <Button className="mt-5" onClick={() => void logout()}>Sign out</Button>}
        </div>
      </main>
    )
  }

  const scopeTabs: Array<{ value: QueueScope; label: string }> = [
    { value: "my", label: "My Rooms" },
    { value: "unassigned", label: "Unassigned" },
    { value: "all", label: "All Rooms" },
  ]

  return (
    <main className="min-h-dvh bg-[#FBFAF8] pb-[max(2rem,env(safe-area-inset-bottom))] text-[#0A214A]">
      <header className="border-b border-[#E9E4DF] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E7] text-[#F45B0B] sm:hidden"><Sparkles className="size-4" /></span>
              <div>
                <h1 className="text-xl font-black tracking-tight sm:text-3xl">Housekeeping</h1>
                <p className="mt-0.5 hidden text-sm text-[#66738B] sm:block">Turn over rooms faster and keep every stay guest-ready.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {user.role !== "housekeeping" ? <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link href="/owner/dashboard">Owner Portal</Link></Button> : null}
            {canManage ? <Button variant="ghost" size="icon" aria-label="Housekeeping settings" onClick={() => setSettingsOpen(true)}><Settings2 className="size-4" /></Button> : null}
            <Button variant="ghost" size="icon" aria-label="Refresh Housekeeping" onClick={() => void loadQueue()}><RefreshCw className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void logout()}><LogOut className="size-4" /></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-6 lg:px-8">
        {isManagement ? (
          <div className="ml-auto flex w-fit rounded-xl border border-[#E8E4E0] bg-white p-1" role="tablist" aria-label="Housekeeping workspace">
            <button type="button" role="tab" aria-selected={workspaceTab === "queue"} onClick={() => setWorkspaceTab("queue")} className={cn("min-h-9 rounded-lg px-4 text-sm font-bold", workspaceTab === "queue" ? "bg-[#FFF0E7] text-[#D94F07]" : "text-[#66738B]")}>Operations</button>
            <button type="button" role="tab" aria-selected={workspaceTab === "history"} onClick={() => setWorkspaceTab("history")} className={cn("min-h-9 rounded-lg px-4 text-sm font-bold", workspaceTab === "history" ? "bg-[#FFF0E7] text-[#D94F07]" : "text-[#66738B]")}>History</button>
          </div>
        ) : null}

        {workspaceTab === "queue" ? (
          <>
            <section className="grid grid-cols-4 gap-1.5 sm:gap-3" aria-label="Housekeeping summary">
              <SummaryCard label="Needs Cleaning" value={statusCounts.needs_cleaning} tone="orange" icon={Clock3} active={statusView === "needs_cleaning"} onClick={() => selectStatusView("needs_cleaning")} />
              <SummaryCard label="In Progress" value={statusCounts.cleaning} tone="blue" icon={Sparkles} active={statusView === "cleaning"} onClick={() => selectStatusView("cleaning")} />
              <SummaryCard label="Ready" value={statusCounts.ready} tone="green" icon={CheckCircle2} active={statusView === "ready"} onClick={() => selectStatusView("ready")} />
              <SummaryCard label="Urgent" value={statusCounts.urgent} tone="red" icon={AlertTriangle} active={statusView === "urgent"} onClick={() => selectStatusView("urgent")} />
            </section>

            {currentCleaning ? (
              <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-[#F7FCFF] p-3 shadow-sm sm:p-4" aria-labelledby="currently-cleaning-title">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <RoomIdentity />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700">In Progress</span>
                      <h2 id="currently-cleaning-title" className="text-sm font-black text-blue-900">Currently Cleaning</h2>
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-lg font-black">{currentCleaning.label}</p>
                      <p className="text-sm text-[#52617C]">{currentCleaning.roomType || "Room Type not set"}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#52617C]">
                      <span>Started {formatDuration(currentCleaning.operation?.timing.cleaningSeconds)} ago</span>
                      <span>Assigned to <strong className="text-[#0A214A]">{assignmentLabel(currentCleaning, user.staffId)}</strong></span>
                    </div>
                  </div>
                  <Button className="min-h-11 bg-[#F04B00] px-6 hover:bg-[#D94400]" onClick={() => setCompletionRoomId(currentCleaning.servicePointId)}>Finish Cleaning</Button>
                  <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={() => setDetailsRoomId(currentCleaning.servicePointId)}>View details <ChevronRight /></Button>
                </div>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-[#E8E4E0] bg-white shadow-sm">
              <div className="border-b border-[#ECE8E4] p-3 sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <p className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#78859A]">Status</p>
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2" role="tablist" aria-label="Housekeeping status">
                      {STATUS_TABS.map((tab) => (
                        <button key={tab.value} type="button" role="tab" aria-selected={statusView === tab.value} onClick={() => selectStatusView(tab.value)} className={cn("min-h-10 shrink-0 rounded-xl border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45B0B] sm:px-4 sm:text-sm", statusView === tab.value ? "border-[#F04B00] bg-[#F04B00] text-white" : "border-[#E4DFDA] bg-white text-[#0A214A] hover:bg-[#FBF8F5]")}>{tab.label} ({statusCounts[tab.value]})</button>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 lg:shrink-0">
                    <p className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#78859A]">Assignment</p>
                    <div className="grid grid-cols-3 gap-1.5 sm:flex sm:gap-2" role="tablist" aria-label="Housekeeping assignment scope">
                      <span className="sr-only">My Rooms, Unassigned, and Other Assigned Rooms are available through these scope controls.</span>
                      {scopeTabs.map((tab) => (
                        <button key={tab.value} type="button" role="tab" aria-selected={effectiveScope === tab.value} onClick={() => setScope(tab.value)} className={cn("min-h-10 min-w-0 rounded-xl border px-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F45B0B] sm:shrink-0 sm:px-4 sm:text-sm", effectiveScope === tab.value ? "border-[#F04B00] bg-[#F04B00] text-white" : "border-[#E4DFDA] bg-white text-[#0A214A] hover:bg-[#FBF8F5]")}>{tab.label} ({scopeCounts[tab.value]})</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-w-0 flex-1 gap-2">
                    <label className="relative min-w-0 flex-1">
                      <span className="sr-only">Search rooms</span>
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#78859A]" />
                      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rooms or room type..." className="h-11 rounded-xl border-[#E4DFDA] pl-9" />
                    </label>
                    <Button aria-label="Filters" variant="outline" className="relative h-11 w-11 shrink-0 justify-center rounded-xl px-0 sm:w-auto sm:px-4" onClick={() => setFiltersOpen(true)}><SlidersHorizontal /><span className="hidden sm:inline">Filters</span>{activeFilterCount ? <span className="absolute -right-1 -top-1 rounded-full bg-[#F04B00] px-1.5 py-0.5 text-[10px] text-white sm:static">{activeFilterCount}</span> : null}</Button>
                  </div>
                  <Select value={sort} onValueChange={(value) => setSort(value as QueueSort)}>
                    <SelectTrigger className="h-11 w-full rounded-xl sm:w-44" aria-label="Sort Housekeeping rooms"><ArrowUpDown className="size-4" /><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="priority">Sort: Priority</SelectItem><SelectItem value="waiting">Waiting longest</SelectItem><SelectItem value="room">Room</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              {error ? (
                <div role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void loadQueue()}>Try again</Button></div>
              ) : null}

              {!visibleRooms.length && !error ? (
                <div className="p-10 text-center">
                  <CheckCircle2 className="mx-auto size-9 text-emerald-500" />
                  <h2 className="mt-3 font-black">{emptyRoomsMessage(statusView, effectiveScope)}</h2>
                  <p className="mt-1 text-sm text-[#66738B]">The queue updates automatically when Housekeeping work changes.</p>
                  {activeFilterCount || query ? <Button variant="outline" size="sm" className="mt-4" onClick={() => { setFilters(EMPTY_FILTERS); setQuery("") }}>Clear filters</Button> : null}
                </div>
              ) : null}

              {visibleRooms.length ? (
                <>
                  <div className="hidden lg:block" data-layout="desktop-table">
                    <Table>
                      <TableHeader><TableRow className="bg-[#FAF8F6] hover:bg-[#FAF8F6]"><TableHead className="pl-5">Room</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Assignment</TableHead><TableHead>Time</TableHead>{hasNotes ? <TableHead>Notes</TableHead> : null}<TableHead className="pr-5 text-right">Action</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {visibleRooms.map((room) => {
                          const operation = room.operation
                          const busy = busyOperationId === operation?.housekeepingOperationId
                          const overdue = operation?.timing.waitingOverdue || operation?.timing.cleaningOverdue
                          return (
                            <TableRow key={room.servicePointId} className="h-[68px]">
                              <TableCell className="pl-5"><button type="button" className="flex items-center gap-3 text-left font-black hover:text-[#F04B00]" onClick={() => setDetailsRoomId(room.servicePointId)}><RoomIdentity compact /><span>{room.label}</span></button></TableCell>
                              <TableCell className="text-[#52617C]">{room.roomType || "Not set"}</TableCell>
                              <TableCell><div className="flex flex-wrap gap-1"><PriorityBadge priority={operation?.priority || "normal"} /><StatusBadge readiness={room.readiness} /></div></TableCell>
                              <TableCell><span className="inline-flex items-center gap-1.5 text-sm"><CircleUserRound className="size-4 text-[#78859A]" />{assignmentLabel(room, user.staffId)}</span></TableCell>
                              <TableCell><span className={cn("text-xs font-semibold", overdue ? "text-red-600" : "text-[#52617C]")}>{elapsedLabel(room)}</span></TableCell>
                              {hasNotes ? <TableCell className="max-w-40 truncate text-xs text-[#66738B]">{operation?.note || ""}</TableCell> : null}
                              <TableCell className="pr-5"><div className="flex justify-end gap-2"><Button size="sm" variant={isAssignmentAction(room) || room.allowedActions.start || room.allowedActions.complete ? "default" : "outline"} className={cn((isAssignmentAction(room) || room.allowedActions.start || room.allowedActions.complete) && "bg-[#F04B00] hover:bg-[#D94400]")} disabled={busy} onClick={() => openPrimaryAction(room)}>{busy ? <Loader2 className="animate-spin" /> : null}{actionLabel(room)}</Button><Button variant="ghost" size="icon" aria-label={`View details for ${room.label}`} onClick={() => setDetailsRoomId(room.servicePointId)}><Eye className="size-4" /></Button></div></TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="hidden divide-y sm:block lg:hidden" data-layout="tablet-list">
                    {visibleRooms.map((room) => {
                      const operation = room.operation
                      const busy = busyOperationId === operation?.housekeepingOperationId
                      return (
                        <article key={room.servicePointId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4">
                          <RoomIdentity />
                          <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><h3 className="font-black">{room.label}</h3><PriorityBadge priority={operation?.priority || "normal"} /><StatusBadge readiness={room.readiness} /></div><p className="mt-1 text-xs text-[#66738B]">{room.roomType || "Room Type not set"} · {elapsedLabel(room)} · {assignmentLabel(room, user.staffId)}</p></div>
                          <div className="flex items-center gap-1"><Button size="sm" disabled={busy} onClick={() => openPrimaryAction(room)} className="bg-[#F04B00] hover:bg-[#D94400]">{actionLabel(room)}</Button><Button variant="ghost" size="icon" aria-label={`View details for ${room.label}`} onClick={() => setDetailsRoomId(room.servicePointId)}><ChevronRight className="size-4" /></Button></div>
                        </article>
                      )
                    })}
                  </div>

                  <div className="divide-y sm:hidden" data-layout="mobile-cards">
                    {visibleRooms.map((room) => {
                      const operation = room.operation
                      const busy = busyOperationId === operation?.housekeepingOperationId
                      const overdue = operation?.timing.waitingOverdue || operation?.timing.cleaningOverdue
                      return (
                        <article key={room.servicePointId} className="p-3.5">
                          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><h3 className="font-black">{room.label}</h3><PriorityBadge priority={operation?.priority || "normal"} /></div><div className="mt-1.5"><StatusBadge readiness={room.readiness} /></div></div><Button size="sm" disabled={busy} onClick={() => openPrimaryAction(room)} className={cn("min-w-20", actionLabel(room) !== "View" && "bg-[#F04B00] hover:bg-[#D94400]")}>{busy ? <Loader2 className="animate-spin" /> : null}{actionLabel(room)}</Button></div>
                          <button type="button" className="mt-2 flex w-full items-center justify-between gap-2 text-left text-xs" onClick={() => setDetailsRoomId(room.servicePointId)}><span className={cn("font-semibold", overdue ? "text-red-600" : "text-[#66738B]")}>{elapsedLabel(room)} · {assignmentLabel(room, user.staffId)}</span><ChevronRight className="size-4 shrink-0 text-[#78859A]" /></button>
                        </article>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </section>
          </>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[#E8E4E0] bg-white shadow-sm">
            <div className="grid gap-2 border-b p-4 sm:grid-cols-2">
              <Select value={historyRoom} onValueChange={setHistoryRoom}><SelectTrigger aria-label="Filter history by room"><SelectValue placeholder="All rooms" /></SelectTrigger><SelectContent><SelectItem value="all">All rooms</SelectItem>{allRooms.map((room) => <SelectItem key={room.servicePointId} value={room.servicePointId}>{room.label}</SelectItem>)}</SelectContent></Select>
              <Select value={historyStaff} onValueChange={setHistoryStaff}><SelectTrigger aria-label="Filter history by staff"><SelectValue placeholder="All staff" /></SelectTrigger><SelectContent><SelectItem value="all">All staff</SelectItem>{eligibleStaff.map((staff) => <SelectItem key={staff.staffId} value={staff.staffId}>{staff.name}</SelectItem>)}</SelectContent></Select>
            </div>
            {!history.length && !historyLoading ? <div className="p-10 text-center"><History className="mx-auto size-9 text-[#78859A]" /><h2 className="mt-3 font-black">No completed Housekeeping work</h2><p className="mt-1 text-sm text-[#66738B]">Completed turnovers will appear here.</p></div> : null}
            <div className="divide-y">
              {history.map((operation) => (
                <article key={operation.housekeepingOperationId} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3"><div><h2 className="font-black">{operation.servicePointLabel || operation.servicePointId}</h2><p className="mt-1 text-xs text-[#66738B]">{formatDateTime(operation.completedAt, timezone)} · Checkout turnover</p></div><PriorityBadge priority={operation.priority} /></div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt className="text-xs text-[#78859A]">Assigned</dt><dd className="font-semibold">{operation.assignedToName || operation.assignedTo || "Unassigned"}</dd></div><div><dt className="text-xs text-[#78859A]">Started by</dt><dd className="font-semibold">{operation.claimedByName || operation.claimedBy || "Not recorded"}</dd></div><div><dt className="text-xs text-[#78859A]">Completed by</dt><dd className="font-semibold">{operation.completedByName || operation.completedBy || "Not recorded"}</dd></div><div><dt className="text-xs text-[#78859A]">Cleaning duration</dt><dd className="font-semibold">{formatDuration(operation.timing.cleaningSeconds)}</dd></div></dl>
                  <p className="mt-3 rounded-xl bg-[#F8F7F5] px-3 py-2 text-xs">{supplyLabel(operation)}</p>
                  {operation.inventoryException?.status === "unresolved" ? <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><strong>Unresolved Inventory exception</strong>{canManage ? <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" asChild><Link href="/owner/inventory">Open Inventory</Link></Button><Button size="sm" variant="outline" onClick={() => setResolveOperation(operation)}>Mark reconciled</Button></div> : null}</div> : null}
                </article>
              ))}
            </div>
            {historyLoading ? <div className="flex justify-center p-4"><Loader2 className="size-5 animate-spin" aria-label="Loading history" /></div> : null}
            {historyHasNext && !historyLoading ? <div className="p-4"><Button variant="outline" className="w-full" onClick={() => void loadHistory({ cursor: historyCursor, append: true })}>Load more history</Button></div> : null}
          </section>
        )}
      </div>

      <Sheet open={Boolean(detailsRoom)} onOpenChange={(open) => { if (!open) setDetailsRoomId(null) }}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          {detailsRoom ? (
            <>
              <SheetHeader className="border-b p-5 pr-12 text-left"><div className="flex items-center gap-3"><RoomIdentity /><div><SheetTitle className="text-xl font-black text-[#0A214A]">{detailsRoom.label}</SheetTitle><SheetDescription>{detailsRoom.roomType || "Room Type not set"}</SheetDescription></div></div></SheetHeader>
              <div className="space-y-5 p-5">
                <section><h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#78859A]">Details</h3><dl className="mt-3 space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><dt>Status</dt><dd><StatusBadge readiness={detailsRoom.readiness} /></dd></div><div className="flex items-center justify-between gap-3"><dt>Priority</dt><dd className="font-semibold">{PRIORITY_LABELS[detailsRoom.operation?.priority || "normal"]}</dd></div><div className="flex items-center justify-between gap-3"><dt>Assignment</dt><dd className="font-semibold">{assignmentLabel(detailsRoom, user.staffId)}</dd></div><div className="flex items-center justify-between gap-3"><dt>Time</dt><dd className="font-semibold">{elapsedLabel(detailsRoom)}</dd></div>{detailsRoom.operation ? <div className="flex items-center justify-between gap-3"><dt>Supply status</dt><dd className="max-w-52 text-right font-semibold">{supplyLabel(detailsRoom.operation)}</dd></div> : null}</dl></section>
                {detailsRoom.operation?.note?.trim() ? <section className="rounded-xl bg-[#F8F7F5] p-3"><h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#78859A]">Notes</h3><p className="mt-2 text-sm">{detailsRoom.operation.note}</p></section> : null}
                {detailsRoom.operation?.inventoryException?.status === "unresolved" ? <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><h3 className="font-black">Inventory discrepancy</h3><p className="mt-1 text-xs">{detailsRoom.operation.inventoryException.failureMessage}</p></div></div>{canManage ? <div className="mt-3 flex flex-wrap gap-2">{!detailsRoom.operation.inventoryException.acknowledgedAt && detailsRoom.operation.status === "cleaning" ? <Button size="sm" variant="outline" onClick={() => void acknowledgeException(detailsRoom.operation!)}>Acknowledge exception</Button> : null}<Button size="sm" variant="outline" asChild><Link href="/owner/inventory">Open Inventory</Link></Button><Button size="sm" variant="outline" onClick={() => setResolveOperation(detailsRoom.operation)}>Mark reconciled</Button></div> : null}</section> : null}
                {detailsRoom.operation ? <section><h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#78859A]">History</h3><div className="mt-3 space-y-3 border-l-2 border-[#EEE9E4] pl-4 text-sm"><p><strong>Turnover created</strong><br /><span className="text-xs text-[#66738B]">{formatDateTime(detailsRoom.operation.createdAt, timezone)}</span></p>{detailsRoom.operation.assignmentHistory.map((entry, index) => <p key={`${entry.occurredAt}-${index}`}><strong>{entry.action === "reassigned" ? "Reassigned" : "Assigned"} to {entry.assignee.name || entry.assignee.staffId}</strong><br /><span className="text-xs text-[#66738B]">{formatDateTime(entry.occurredAt, timezone)} by {entry.performedBy.name || entry.performedBy.staffId}</span></p>)}{detailsRoom.operation.startedAt ? <p><strong>Cleaning started by {detailsRoom.operation.claimedByName || detailsRoom.operation.claimedBy}</strong><br /><span className="text-xs text-[#66738B]">{formatDateTime(detailsRoom.operation.startedAt, timezone)}</span></p> : null}{detailsRoom.operation.completedAt ? <p><strong>Marked ready by {detailsRoom.operation.completedByName || detailsRoom.operation.completedBy}</strong><br /><span className="text-xs text-[#66738B]">{formatDateTime(detailsRoom.operation.completedAt, timezone)}</span></p> : null}</div></section> : null}
                {detailsRoom.operation?.active && (canAssign || canManage) ? <section className="border-t pt-5"><h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#78859A]">Management</h3><div className="mt-3 grid gap-2">{canAssign && detailsRoom.operation.status === "needs_cleaning" ? <Button variant="outline" onClick={() => openAssignment(detailsRoom)}><UserRoundCheck />{detailsRoom.operation.assignedTo ? "Reassign" : "Assign"}</Button> : null}{canManage ? <Select value={detailsRoom.operation.priority} onValueChange={(value) => void setPriority(detailsRoom.operation!, value as HousekeepingPriority)}><SelectTrigger aria-label={`Priority for ${detailsRoom.label}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="priority">Priority</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select> : null}</div></section> : null}
              </div>
              <SheetFooter className="sticky bottom-0 border-t bg-white p-4">{detailsRoom.allowedActions.start || detailsRoom.allowedActions.serviceRoom || detailsRoom.allowedActions.noSuppliesUsed || detailsRoom.allowedActions.complete ? <Button className="min-h-11 bg-[#F04B00] hover:bg-[#D94400]" onClick={() => { setDetailsRoomId(null); openPrimaryAction(detailsRoom) }}>{actionLabel(detailsRoom)}</Button> : null}</SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Filters</DialogTitle><DialogDescription>Show the rooms most relevant to this shift.</DialogDescription></DialogHeader>
          <div className="space-y-5">
            <fieldset>
              <legend className="text-sm font-black">Status</legend>
              <p className="mt-1 text-xs text-[#66738B]">This stays synchronized with the status tabs.</p>
              <div className="mt-2 grid gap-2">
                {STATUS_TABS.map((option) => <label key={option.value} className="flex min-h-10 items-center gap-3 rounded-xl border px-3 text-sm font-semibold"><input type="radio" name="housekeeping-status" checked={statusView === option.value} onChange={() => selectStatusView(option.value)} className="size-4 accent-[#F04B00]" />{option.label}</label>)}
              </div>
            </fieldset>
            <fieldset disabled={statusView === "urgent"} className={cn(statusView === "urgent" && "opacity-60")}>
              <legend className="text-sm font-black">Priority</legend>
              {statusView === "urgent" ? <p className="mt-1 text-xs text-[#66738B]">Urgent priority is already selected by the status view.</p> : null}
              <div className="mt-2 grid grid-cols-3 gap-2">{(["normal", "priority", "urgent"] as HousekeepingPriority[]).map((priority) => <label key={priority} className="flex min-h-10 items-center gap-2 rounded-xl border px-2 text-xs font-semibold"><input type="checkbox" checked={filters.priorities.includes(priority)} onChange={() => setFilters((current) => ({ ...current, priorities: current.priorities.includes(priority) ? current.priorities.filter((value) => value !== priority) : [...current.priorities, priority] }))} className="size-4 accent-[#F04B00]" />{PRIORITY_LABELS[priority]}</label>)}</div>
            </fieldset>
            <label className="space-y-2 text-sm font-black">Room Type<Select value={filters.roomType} onValueChange={(roomType) => setFilters((current) => ({ ...current, roomType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All room types</SelectItem>{roomTypes.map((roomType) => <SelectItem key={roomType} value={roomType}>{roomType}</SelectItem>)}</SelectContent></Select></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>Clear advanced filters</Button><Button className="bg-[#F04B00] hover:bg-[#D94400]" onClick={() => setFiltersOpen(false)}>Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(claimRoom)} onOpenChange={(open) => { if (!open) setClaimRoomId(null) }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Claim Room</DialogTitle><DialogDescription>Claiming this room assigns it to you and starts cleaning immediately.</DialogDescription></DialogHeader>{claimRoom ? <div className="flex items-center gap-3 rounded-xl bg-[#F8F7F5] p-3"><RoomIdentity /><div><p className="font-black">{claimRoom.label}</p><p className="text-sm text-[#66738B]">{claimRoom.roomType || "Room Type not set"}</p></div></div> : null}<DialogFooter><Button variant="outline" onClick={() => setClaimRoomId(null)}>Cancel</Button><Button className="bg-[#F04B00] hover:bg-[#D94400]" disabled={!claimRoom || busyOperationId !== null} onClick={async () => { if (claimRoom && await runAction(claimRoom, "start")) setClaimRoomId(null) }}><Play />Claim & Start Cleaning</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={Boolean(completionRoom)} onOpenChange={(open) => { if (!open) setCompletionRoomId(null) }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Complete Cleaning</DialogTitle><DialogDescription>{completionRoom ? `${completionRoom.label} · ${completionRoom.roomType || "Room Type not set"}` : "Confirm the canonical supply outcome before marking this room ready."}</DialogDescription></DialogHeader>{completionRoom?.operation ? <div className="rounded-xl border bg-[#F8F7F5] p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#78859A]">Supply status</p><p className="mt-2 flex items-center gap-2 font-bold">{completionRoom.operation.supplyOutcome === "pending" ? <Clock3 className="size-4 text-amber-600" /> : <CheckCircle2 className="size-4 text-emerald-600" />}{supplyLabel(completionRoom.operation)}</p>{completionRoom.operation.inventoryException?.status === "unresolved" ? <p className="mt-2 text-xs text-amber-800">An Inventory discrepancy must be acknowledged by authorized management before completion.</p> : null}</div> : null}<DialogFooter className="sm:flex-col">{completionRoom?.allowedActions.serviceRoom ? <Button aria-label="Service Room - record actual supplies" className="w-full bg-[#F04B00] hover:bg-[#D94400]" onClick={() => { setServiceRoom(completionRoom); setCompletionRoomId(null) }}><PackageCheck />Record Supplies</Button> : null}{completionRoom?.allowedActions.noSuppliesUsed ? <Button aria-label="No supplies used" variant="outline" className="w-full" disabled={busyOperationId !== null} onClick={() => { if (completionRoom) void runAction(completionRoom, "no-supplies") }}>No Supplies Used</Button> : null}{completionRoom?.allowedActions.complete ? <Button className="w-full bg-[#F04B00] hover:bg-[#D94400]" disabled={busyOperationId !== null} onClick={async () => { if (completionRoom && await runAction(completionRoom, "complete")) setCompletionRoomId(null) }}><CheckCircle2 />Mark Room Ready</Button> : null}<Button variant="ghost" className="w-full" onClick={() => setCompletionRoomId(null)}>Cancel</Button></DialogFooter></DialogContent>
      </Dialog>

      {serviceRoom?.operation ? <RoomUsageDialog open={Boolean(serviceRoom)} onOpenChange={(open) => { if (!open) setServiceRoom(null) }} onCompleted={() => { setServiceRoom(null); void loadQueue() }} initialServicePointId={serviceRoom.servicePointId} initialRoomLabel={serviceRoom.label} workflow="service_room" housekeepingOperationId={serviceRoom.operation.housekeepingOperationId} /> : null}

      <Dialog open={Boolean(assignRoom)} onOpenChange={(open) => { if (!open) { setAssignRoom(null); setSelectedAssignee("") } }}><DialogContent><DialogHeader><DialogTitle>{assignRoom?.operation?.assignedTo ? "Reassign" : "Assign"} {assignRoom?.label}</DialogTitle><DialogDescription>Choose an active Housekeeping staff member. Assignment does not start cleaning.</DialogDescription></DialogHeader><Select value={selectedAssignee} onValueChange={setSelectedAssignee}><SelectTrigger aria-label="Eligible housekeeper"><SelectValue placeholder="Select Housekeeping staff" /></SelectTrigger><SelectContent>{eligibleStaff.map((staff) => <SelectItem key={staff.staffId} value={staff.staffId}>{staff.name}</SelectItem>)}</SelectContent></Select><DialogFooter><Button variant="outline" onClick={() => setAssignRoom(null)}>Cancel</Button><Button disabled={!selectedAssignee || busyOperationId !== null} onClick={() => void saveAssignment()}>Save assignment</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent><DialogHeader><DialogTitle>Housekeeping targets</DialogTitle><DialogDescription>Optional operational targets power overdue indicators. No target is assumed when a field is blank.</DialogDescription></DialogHeader><label className="space-y-2 text-sm font-bold">Target time to start turnover (minutes)<Input inputMode="numeric" min={1} max={10080} value={settingsDraft.targetStartMinutes} onChange={(event) => setSettingsDraft((current) => ({ ...current, targetStartMinutes: event.target.value }))} placeholder="Not configured" /></label><label className="space-y-2 text-sm font-bold">Target cleaning duration (minutes)<Input inputMode="numeric" min={1} max={10080} value={settingsDraft.targetCleaningMinutes} onChange={(event) => setSettingsDraft((current) => ({ ...current, targetCleaningMinutes: event.target.value }))} placeholder="Not configured" /></label><DialogFooter><Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={() => void saveSettings()}>Save targets</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(resolveOperation)} onOpenChange={(open) => { if (!open) { setResolveOperation(null); setResolutionMovementIds("") } }}><DialogContent><DialogHeader><DialogTitle>Mark Inventory discrepancy reconciled</DialogTitle><DialogDescription>First correct stock through canonical Inventory Receive or Adjust. Then enter the resulting movement ID. This action does not change stock.</DialogDescription></DialogHeader><label className="space-y-2 text-sm font-bold">Inventory movement ID<Input value={resolutionMovementIds} onChange={(event) => setResolutionMovementIds(event.target.value)} placeholder="imv_..." /></label><DialogFooter><Button variant="outline" onClick={() => setResolveOperation(null)}>Cancel</Button><Button disabled={!resolutionMovementIds.trim() || busyOperationId !== null} onClick={() => void resolveException()}>Verify and resolve</Button></DialogFooter></DialogContent></Dialog>
    </main>
  )
}
