"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import apiClient from "@/lib/axios-config"
import { useEventSource } from "@/hooks/use-event-source"
import { MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { useBusinessSettings } from "@/contexts/BusinessContext"

export type ReservationDashboardMode = "timeslot" | "stay"

export interface ReservationDashboardRecord {
  _id: string
  status: string
  customerName?: string
  phone?: string
  email?: string
  date?: string
  time?: string
  startTime?: string
  checkInDate?: string
  paymentStatus?:
  | "pending"
  | "paid"
  | "failed"
  | "partially_refunded"
  | "refunded"
  paymentExpiresAt?: string
  paymentUrl?: string | null
  currency?: string
  checkOutDate?: string
  originalPaidAmountCents?: number
  refundedAmountCents?: number
  remainingRefundableAmountCents?: number
  refundEconomics?: {
    paymentChannel: "online" | "offline"
    customerPaidAmountCents: number
    totalPlatformFeeCents: number
    customerPlatformFeeCents: number
    businessAbsorbedPlatformFeeCents: number
    customerProcessingFeeCents: number
    customerRefundableCeilingCents: number
    successfulRefundedAmountCents: number
    remainingRefundableAmountCents: number
  }
  refundPending?: boolean
  checkInCodeLockedAt?: string | null
  checkInCodeFailedAttempts?: number
  arrivedAt?: string | null
  [key: string]: any
}

export interface ReservationDashboardServicePoint {
  _id?: string
  servicePointId: string
  label?: string
  code?: string
  isActive?: boolean
  [key: string]: any
}

export interface ReservationStatusStyle {
  label: string
  dot: string
  bg: string
  text: string
  border: string
}

const PENDING_STATUS: ReservationStatusStyle = {
  label: "Pending",
  dot: "bg-amber-400",
  bg: "bg-amber-50 dark:bg-amber-950/30",
  text: "text-amber-700 dark:text-amber-300",
  border: "border-amber-200 dark:border-amber-800",
}

export const RESERVATION_STATUS_CONFIG: Record<
  ReservationDashboardMode,
  Record<string, ReservationStatusStyle>
> = {
  timeslot: {
    pending: PENDING_STATUS,
    confirmed: { label: "Expected", dot: "bg-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
    arrived: { label: "Arrived", dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
    seated: { label: "Seated", dot: "bg-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
    completed: { label: "Completed", dot: "bg-slate-400", bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700" },
    cancelled: { label: "Cancelled", dot: "bg-red-400", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
    declined: { label: "Declined", dot: "bg-red-400", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
    no_show: { label: "No Show", dot: "bg-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  },
  stay: {
    pending: PENDING_STATUS,
    pending_approval: { label: "Pending Approval", dot: "bg-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
    accepted_awaiting_payment: { label: "Accepted", dot: "bg-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
    confirmed: { label: "Confirmed", dot: "bg-green-500", bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
    checked_in: { label: "Checked In", dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
    checked_out: { label: "Checked Out", dot: "bg-gray-400", bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" },
    completed: { label: "Completed", dot: "bg-gray-400", bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" },
    cancelled: { label: "Cancelled", dot: "bg-red-400", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
    declined: { label: "Declined", dot: "bg-red-400", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
    no_show: { label: "No Show", dot: "bg-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
    expired: { label: "Expired", dot: "bg-gray-500", bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-700 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" },
  },
}

export const RESERVATION_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export const RESERVATION_DAY_ABBRS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function getStatusSuccessMessage(
  mode: ReservationDashboardMode,
  status: string,
) {
  if (mode === "stay") {
    if (status === "accepted_awaiting_payment") {
      return "Reservation accepted. Payment link sent to guest."
    }
    if (status === "cancelled") {
      return "Reservation cancelled and guest notified."
    }
  } else {
    if (status === "confirmed") {
      return "Reservation confirmed and customer notified."
    }
    if (status === "arrived") {
      return "Guest marked as arrived."
    }
    if (status === "seated") {
      return "Guest marked as seated."
    }
    if (status === "completed") {
      return "Visit completed."
    }
    if (status === "cancelled") {
      return "Reservation cancelled and customer notified."
    }
    if (status === "declined") {
      return "Reservation declined and customer notified."
    }
  }

  return "Reservation updated."
}

export function useReservationDashboard<
  T extends ReservationDashboardRecord = ReservationDashboardRecord,
>({
  businessId,
  mode,
  canReadServicePoints = true,
}: {
  businessId?: string
  mode: ReservationDashboardMode
  canReadServicePoints?: boolean
}) {
  const { timezone } = useBusinessSettings()
  const [reservations, setReservations] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [listCursor, setListCursor] = useState<string | null>(null)
  const [previousCursor, setPreviousCursor] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    hasNextPage: false,
    hasPreviousPage: false,
    nextCursor: null as string | null,
    previousCursor: null as string | null,
    totalCount: 0,
  })

  const [stats, setStats] = useState<any>({
    today: 0,
    upcoming: 0,
    pending: 0,
    confirmed: 0,
    arrived: 0,
    arrivalsToday: { total: 0, checkedIn: 0, remaining: 0 },
    departuresToday: { total: 0, checkedOut: 0, remaining: 0 },
    inHouse: { reservations: 0, guests: 0 },
    availableTonight: { available: 0, totalRooms: 0 },
    expectedToday: { total: 0, upcoming: 0 },
    arrivedToday: { total: 0, percent: 0 },
    seatedNow: { reservations: 0, guests: 0 },
    tableAvailability: { available: 0, total: 0, occupied: 0, reservedLater: 0 },
    nextBusyTime: null,
  })

  const [operations, setOperations] = useState<{
    arrivals: T[];
    departures: T[];
    inHouse: T[];
    reservations: T[];
    needsAttention: T[];
  }>({
    arrivals: [],
    departures: [],
    inHouse: [],
    reservations: [],
    needsAttention: [],
  })

  const [businessDate, setBusinessDate] = useState<string | null>(null)
  const [operationalDate, setOperationalDate] = useState("")

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingReservationId, setDeletingReservationId] = useState<string | null>(null)

  const [filterDate, setFilterDate] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  const [listSortBy, setListSortBy] = useState<"createdAt" | "checkInDate">("checkInDate")
  const [listSortDirection, setListSortDirection] = useState<"desc" | "asc">("desc")

  const [reservationsEnabled, setReservationsEnabled] = useState(true)
  const [isTogglingReservations, setIsTogglingReservations] = useState(false)

  const [viewMode, setViewMode] = useState<"list" | "calendar" | "today" | "all">("today")
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [calendarDays, setCalendarDays] = useState<7 | 14>(7)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayViewMode, setDayViewMode] = useState<"list" | "grid">("grid")
  const [servicePoints, setServicePoints] = useState<ReservationDashboardServicePoint[]>([])

  const clientToday = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date())
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${value.year}-${value.month}-${value.day}`
  }, [timezone])

  const buildListParams = useCallback((cursorArg: string | null) => {
    const params = new URLSearchParams()
    if (businessId) params.set("businessId", businessId)
    params.set("view", "list")
    params.set("mode", mode)
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (filterDate) params.set("date", filterDate)
    if (searchQuery) params.set("search", searchQuery)
    params.set("sortBy", listSortBy)
    params.set("sortDirection", listSortDirection)

    if (cursorArg?.startsWith("PREV_")) {
      params.set("previousCursor", cursorArg.replace("PREV_", ""))
    } else if (cursorArg) {
      params.set("cursor", cursorArg)
    }
    return params.toString()
  }, [businessId, filterStatus, filterDate, searchQuery, listSortBy, listSortDirection, mode])

  const fetchList = useCallback(async (cursorArg: string | null = null, silent = false) => {
    if (!businessId) return
    if (!silent) setIsLoading(true)
    try {
      const response = await apiClient.get(`/owner/reservations?${buildListParams(cursorArg)}`)
      setReservations(response.data.reservations || [])
      if (response.data.pagination) setPagination(response.data.pagination)
      if (response.data.stats) setStats(response.data.stats)
      setError(null)
    } catch {
      if (!silent) setError("Failed to load list reservations.")
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [businessId, buildListParams])

  const fetchCalendar = useCallback(async (startStr: string, endExclusiveStr: string, silent = false) => {
    if (!businessId) return
    if (!silent) setIsLoading(true)
    try {
      const response = await apiClient.get(
        `/owner/reservations?businessId=${businessId}&view=calendar&mode=${mode}&start=${startStr}&endExclusive=${endExclusiveStr}`
      )
      setReservations(response.data || [])
      setError(null)
    } catch {
      if (!silent) setError("Failed to load calendar reservations.")
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [businessId, mode])

  const fetchDay = useCallback(async (dateStr: string, silent = false) => {
    if (!businessId) return
    if (!silent) setIsLoading(true)
    try {
      const response = await apiClient.get(`/owner/reservations?businessId=${businessId}&view=day&mode=${mode}&date=${dateStr}`)
      setReservations(response.data || [])
      setError(null)
    } catch {
      if (!silent) setError("Failed to load day reservations.")
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [businessId, mode])

  const fetchToday = useCallback(async (silent = false) => {
    if (!businessId) return
    if (!silent) setIsLoading(true)
    try {
      const params = new URLSearchParams({ businessId, view: "today", mode })
      if (mode === "timeslot" && operationalDate) params.set("date", operationalDate)
      const response = await apiClient.get(`/owner/reservations?${params.toString()}`)
      if (response.data.operations) setOperations(response.data.operations)
      if (Array.isArray(response.data.operations?.reservations)) {
        setReservations(response.data.operations.reservations)
      }
      if (response.data.stats) setStats(response.data.stats)
      if (response.data.businessDate) setBusinessDate(response.data.businessDate)
      setError(null)
    } catch {
      if (!silent) setError("Failed to load today's operations.")
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [businessId, mode, operationalDate])

  const refreshActiveView = useCallback(async (silent = false) => {
    if (viewMode === "list" || viewMode === "all") {
      await fetchList(previousCursor ? `PREV_${previousCursor}` : listCursor, silent)
    } else if (viewMode === "today") {
      await fetchToday(silent)
    } else if (viewMode === "calendar") {
      // Calendar range is driven by the tape chart via calendarDate + calendarDays
      // calendarDate holds the visibleStart; calendarDays holds the window size
      const startStr = calendarDate.toISOString().split("T")[0]
      const endDate = new Date(calendarDate)
      endDate.setUTCDate(endDate.getUTCDate() + calendarDays)
      const endExclusiveStr = endDate.toISOString().split("T")[0]
      if (mode === "timeslot") {
        if (!businessId) return
        if (!silent) setIsLoading(true)
        try {
          const month = startStr.slice(0, 7)
          const response = await apiClient.get(
            `/owner/reservations?businessId=${businessId}&view=calendar&mode=${mode}&month=${month}`,
          )
          setReservations(response.data || [])
          setError(null)
        } catch {
          if (!silent) setError("Failed to load calendar reservations.")
        } finally {
          if (!silent) setIsLoading(false)
        }
      } else {
        await fetchCalendar(startStr, endExclusiveStr, silent)
      }
    } else if (selectedDay) {
      await fetchDay(selectedDay, silent)
    }
  }, [viewMode, selectedDay, calendarDate, calendarDays, listCursor, previousCursor, businessId, mode, fetchList, fetchDay, fetchCalendar, fetchToday])

  const reconcileRealtimeReservation = useCallback((payload: any) => {
    const incoming = payload?.reservation
    if (incoming?.reservationMode && incoming.reservationMode !== mode) return
    const incomingId = String(incoming?.id || incoming?._id || "")
    if (!incomingId) return

    setReservations((current) => {
      const exists = current.some((r) => r._id === incomingId)
      if (viewMode === "today") {
        setTimeout(() => refreshActiveView(true), 250)
      }
      if (exists) {
        return current.map((r) =>
          r._id === incomingId
            ? ({
              ...r,
              ...incoming,
              _id: r._id,
            } as T)
            : r
        )
      }

      if ((viewMode === "list" || viewMode === "all") && !listCursor && !previousCursor) {
        setTimeout(() => refreshActiveView(true), 250)
      } else if (viewMode === "calendar" || selectedDay) {
        setTimeout(() => refreshActiveView(true), 250)
      }
      return current
    })
  }, [mode, viewMode, listCursor, previousCursor, selectedDay, refreshActiveView])

  const reservationSseUrl = businessId
    ? `/events?role=reservations&businessId=${encodeURIComponent(businessId)}&permission=${MANAGER_PERMISSIONS.RESERVATIONS_VIEW}`
    : ""

  // Build handlers for all reservation SSE events so the dashboard updates
  // in real time without a manual refresh. The reconcileRealtimeReservation
  // function updates existing records in-place and triggers a silent refetch
  // for new records that fall outside the current view.
  const reservationSseHandlers = useMemo(() => {
    const reconcile = (payload: any) => reconcileRealtimeReservation(payload)
    const RESERVATION_EVENTS = [
      "reservation_created",
      "reservation_pending",
      "reservation_confirmed",
      "reservation_cancelled",
      "reservation_declined",
      "reservation_no_show",
      "reservation_seated",
      "reservation_completed",
      "reservation_checked_out",
      "reservation_expired",
      "reservation_accepted_awaiting_payment",
    ]
    const handlers: Record<string, (payload: any) => void> = {}
    for (const event of RESERVATION_EVENTS) {
      handlers[event] = reconcile
    }
    // reservation_arrived gets a toast in addition to reconciliation
    handlers["reservation_arrived"] = (payload: any) => {
      reconcile(payload)
      const reservation = payload?.reservation
      if (reservation && reservation.status === "arrived") {
        const guestName = reservation.customerName
        toast.info(guestName ? `${guestName} has arrived.` : "A reservation guest has arrived.")
      }
    }
    return handlers
  }, [reconcileRealtimeReservation])

  useEventSource(
    reservationSseUrl,
    reservationSseHandlers,
    { onReconnect: () => refreshActiveView(true) },
  )

  // Primary Data Fetching Effect
  useEffect(() => {
    if (!businessId) return
    let isCurrent = true

    async function fetchInitialSettingsAndData() {
      try {
        const [settingsResponse, servicePointResponse] = await Promise.all([
          apiClient.get(`/business/settings?businessId=${businessId}`),
          canReadServicePoints
            ? apiClient.get(`/owner/service-points?businessId=${businessId}`)
            : Promise.resolve({ data: [] }),
        ])

        if (!isCurrent) return
        setReservationsEnabled(
          settingsResponse.data?.settings?.reservationsEnabled !== false,
        )
        setServicePoints(
          (servicePointResponse.data || []).filter(
            (servicePoint: ReservationDashboardServicePoint) => servicePoint.isActive,
          ),
        )

      } catch {
        if (isCurrent) setError("Failed to initialize reservations dashboard.")
      }
    }

    fetchInitialSettingsAndData()

    return () => {
      isCurrent = false
    }
  }, [businessId, canReadServicePoints]) // View changes are handled below.

  // Watch for View/Filter/Sort changes
  useEffect(() => {
    if (!businessId) return

    // When filters or sorting change, reset pagination
    setListCursor(null)
    setPreviousCursor(null)
    setExpandedId(null)
  }, [filterStatus, filterDate, searchQuery, listSortBy, listSortDirection, viewMode, selectedDay, calendarDate, operationalDate, businessId])

  // Trigger active fetch when state changes
  useEffect(() => {
    if (!businessId) return
    refreshActiveView()
  }, [listCursor, previousCursor, filterStatus, filterDate, searchQuery, listSortBy, listSortDirection, viewMode, selectedDay, calendarDate, businessId, refreshActiveView])

  // Hotel expiry reconciliation
  useEffect(() => {
    if (!businessId || mode !== "stay") return

    const nextExpiry = reservations
      .filter(
        (reservation) =>
          reservation.status === "accepted_awaiting_payment" &&
          reservation.paymentExpiresAt,
      )
      .map((reservation) => new Date(reservation.paymentExpiresAt!).getTime())
      .filter((expiry) => Number.isFinite(expiry) && expiry > Date.now())
      .sort((first, second) => first - second)[0]

    if (!nextExpiry) return

    const timeout = window.setTimeout(() => {
      refreshActiveView(true).catch(() => {
        toast.error("Failed to refresh expired reservations.")
      })
    }, Math.min(Math.max(nextExpiry - Date.now() + 250, 250), 2_147_000_000))

    return () => window.clearTimeout(timeout)
  }, [businessId, mode, reservations, refreshActiveView])

  async function updateStatus(
    id: string,
    newStatus: string,
    options?: { cancellationReason?: string },
  ) {
    setActionLoadingId(id)
    try {
      const response = await apiClient.patch(
        `/owner/reservations/${id}/status`,
        {
          status: newStatus,
          ...(options?.cancellationReason
            ? { cancellationReason: options.cancellationReason }
            : {}),
        },
      )
      const updatedReservation = response.data?.reservation
      setReservations((current) => current.map((reservation) =>
        reservation._id === id
          ? {
            ...reservation,
            ...(updatedReservation || {}),
            status: updatedReservation?.status || newStatus,
          }
          : reservation
      ))
      await refreshActiveView(true)

      if (response.data?.emailStatus === "failed") {
        toast.warning("Reservation updated, but notification email failed.")
      } else if (response.data?.emailStatus === "sent") {
        toast.success(getStatusSuccessMessage(mode, newStatus))
      } else {
        toast.success(getStatusSuccessMessage(mode, newStatus))
      }
    } catch (requestError: any) {
      toast.error(
        requestError.response?.data?.error || "Failed to update status.",
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  function handleDeleteClick(id: string) {
    setDeletingReservationId(id)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deletingReservationId) return

    setActionLoadingId(deletingReservationId)
    try {
      await apiClient.delete(`/owner/reservations/${deletingReservationId}`)
      setReservations((current) => current.filter(
        (reservation) => reservation._id !== deletingReservationId,
      ))
      await refreshActiveView(true)
      toast.success("Reservation removed from operational views.")
      setDeleteDialogOpen(false)
      setDeletingReservationId(null)
    } catch (requestError: any) {
      toast.error(
        requestError.response?.data?.error || "Failed to archive reservation.",
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  async function toggleReservations() {
    if (!businessId) return

    setIsTogglingReservations(true)
    const newValue = !reservationsEnabled
    try {
      await apiClient.patch("/business/settings/ordering-preferences", {
        businessId: businessId,
        orderingPreferences: {},
        settings: { reservationsEnabled: newValue },
      })
      setReservationsEnabled(newValue)
      toast.success(newValue ? "Reservations enabled" : "Reservations disabled")
    } catch {
      toast.error("Failed to update reservation settings.")
    } finally {
      setIsTogglingReservations(false)
    }
  }

  const filtered = reservations

  const reservationsByDate = useMemo(() => {
    const reservationsByDate: Record<string, T[]> = {}
    for (const reservation of reservations) {
      const date = mode === "stay" ? reservation.checkInDate : reservation.date
      if (!date) continue
      if (!reservationsByDate[date]) reservationsByDate[date] = []
      reservationsByDate[date].push(reservation)
    }
    return reservationsByDate
  }, [mode, reservations])

  const dayReservations = useMemo(() => {
    if (!selectedDay) return []
    return [...(reservationsByDate[selectedDay] || [])].sort(
      (first, second) =>
        (first.startTime || first.time || "").localeCompare(
          second.startTime || second.time || "",
        ),
    )
  }, [reservationsByDate, selectedDay])

  return {
    reservations,
    setReservations,
    isLoading,
    error,
    actionLoadingId,
    setActionLoadingId,
    expandedId,
    setExpandedId,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletingReservationId,
    filterDate,
    setFilterDate,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    listSortBy,
    setListSortBy,
    listSortDirection,
    setListSortDirection,
    reservationsEnabled,
    isTogglingReservations,
    viewMode,
    setViewMode,
    calendarDate,
    setCalendarDate,
    calendarDays,
    setCalendarDays,
    selectedDay,
    setSelectedDay,
    dayViewMode,
    setDayViewMode,
    servicePoints,
    clientToday,
    filtered,
    pagination,
    setListCursor,
    setPreviousCursor,
    listCursor,
    previousCursor,
    stats,
    operations,
    businessDate,
    operationalDate,
    setOperationalDate,
    reservationsByDate,
    dayReservations,
    updateStatus,
    handleDeleteClick,
    confirmDelete,
    toggleReservations,
    refreshActiveView,
  }
}
