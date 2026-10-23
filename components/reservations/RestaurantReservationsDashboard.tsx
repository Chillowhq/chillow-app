"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  AlertCircle,
  Armchair,
  ArrowLeft,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  LayoutGrid,
  LayoutList,
  Loader2,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  Users,
} from "lucide-react"
import { useAuthContext } from "@/contexts/AuthContext"
import { useBusinessSettings, useServicePointTerm } from "@/contexts/BusinessContext"
import { hasManagementPermission, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { apiClient } from "@/lib/axios-config"
import {
  addReservationDateDays,
  formatReservationDate as formatDate,
  formatReservationTime as formatTime,
  isReservationToday as isToday,
} from "@/lib/reservation-date"
import { Skeleton } from "@/components/ui/skeleton"
import {
  RESERVATION_DAY_ABBRS as DAY_ABBRS,
  RESERVATION_MONTH_NAMES as MONTH_NAMES,
  RESERVATION_STATUS_CONFIG,
  useReservationDashboard,
  type ReservationDashboardRecord,
} from "@/components/reservations/dashboard/useReservationDashboard"
import { ReservationStatusBadge } from "@/components/reservations/dashboard/ReservationStatusBadge"
import { ReservationDeleteDialog } from "@/components/reservations/dashboard/ReservationDeleteDialog"
import { RestaurantReservationActions } from "@/components/reservations/dashboard/RestaurantReservationActions"
import { ReservationContentSkeleton } from "@/components/reservations/dashboard/ReservationContentSkeleton"
import {
  StaffRestaurantReservationDialog,
  type StaffRestaurantReservationMode,
} from "@/components/reservations/dashboard/StaffRestaurantReservationDialog"
import { RestaurantTodayView } from "@/components/reservations/dashboard/restaurant/RestaurantTodayView"

const STATUS_CONFIG = RESERVATION_STATUS_CONFIG.timeslot

function ReservationDetail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-foreground">{value || "—"}</dd>
    </div>
  )
}

export function RestaurantReservationsDashboard() {
  const { user } = useAuthContext()
  const { timezone } = useBusinessSettings()
  const servicePointTerm = useServicePointTerm()
  const canManageReservations = hasManagementPermission(user, MANAGER_PERMISSIONS.RESERVATIONS_MANAGE)
  const canManageOperationalSettings = hasManagementPermission(user, MANAGER_PERMISSIONS.SETTINGS_OPERATIONAL_MANAGE)
  const canReadServicePoints = hasManagementPermission(user, MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW)
  const {
    reservations,
    setReservations,
    isLoading,
    error,
    actionLoadingId,
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
    reservationsEnabled,
    isTogglingReservations,
    viewMode,
    setViewMode,
    calendarDate,
    setCalendarDate,
    selectedDay,
    setSelectedDay,
    servicePoints,
    updateStatus,
    handleDeleteClick,
    confirmDelete,
    toggleReservations,
    stats,
    operations,
    businessDate,
    clientToday,
    operationalDate,
    setOperationalDate,
    filtered,
    reservationsByDate,
    dayReservations,
    setListCursor,
    setPreviousCursor,
    pagination,
    refreshActiveView,
  } = useReservationDashboard({
    businessId: user?.businessId,
    mode: "timeslot",
    canReadServicePoints,
  })
  const [staffDialogOpen, setStaffDialogOpen] = useState(false)
  const [staffDialogMode, setStaffDialogMode] = useState<StaffRestaurantReservationMode>("reservation")
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null)
  const [linkedReservation, setLinkedReservation] = useState<ReservationDashboardRecord | null>(null)

  useEffect(() => {
    const reservationId = new URLSearchParams(window.location.search).get("reservationId")
    if (!reservationId) return
    setViewMode("all")
    setFilterDate("")
    setFilterStatus("all")
    setDeepLinkError(null)
    void apiClient.get<{ reservation: ReservationDashboardRecord }>("/owner/reservations", {
      params: { reservationId },
    }).then(({ data }) => {
      setLinkedReservation(data.reservation)
    }).catch(() => {
      setDeepLinkError("This reservation is no longer available or you do not have access to it.")
    })
    // This is intentionally URL-driven once on destination entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!linkedReservation || isLoading) return
    setReservations((current) => [
      linkedReservation,
      ...current.filter((reservation) => reservation._id !== linkedReservation._id),
    ])
    setExpandedId(linkedReservation._id)
    setLinkedReservation(null)
  }, [isLoading, linkedReservation, setExpandedId, setReservations])

  const selectedOperationalDate = businessDate || operationalDate || clientToday
  const formattedOperationalDate = new Date(`${selectedOperationalDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  function renderReservationActions(reservation: ReservationDashboardRecord) {
    if (!canManageReservations) return null
    return (
      <RestaurantReservationActions
        reservation={reservation}
        isBusy={actionLoadingId === reservation._id}
        onStatusChange={(status) => updateStatus(reservation._id, status)}
        onDelete={() => handleDeleteClick(reservation._id)}
        compact
      />
    )
  }

  function openStaffDialog(mode: StaffRestaurantReservationMode) {
    setStaffDialogMode(mode)
    setStaffDialogOpen(true)
  }

  function openReservationInAllView(reservation: ReservationDashboardRecord) {
    setFilterDate(reservation.date || selectedOperationalDate)
    setExpandedId(reservation._id)
    setViewMode("all")
  }

  function renderExpandedDetails(reservation: ReservationDashboardRecord) {
    const timeRange = reservation.startTime && reservation.endTime
      ? `${formatTime(reservation.startTime)} – ${formatTime(reservation.endTime)}`
      : formatTime(reservation.time)
    const assignedServicePoint = reservation.servicePointLabel ||
      (reservation.seatingPreference && reservation.seatingPreference !== "no_preference"
        ? String(reservation.seatingPreference).replace("_", " ")
        : "Unassigned")

    return (
      <div className="grid grid-cols-1 gap-4 pt-5 md:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-xl border border-border/70 bg-background p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">Guest</h3>
          <dl className="space-y-3">
            <ReservationDetail label="Name" value={reservation.customerName} />
            <ReservationDetail label="Party size" value={`${reservation.guestCount || 0} ${reservation.guestCount === 1 ? "guest" : "guests"}`} />
          </dl>
        </section>
        <section className="rounded-xl border border-border/70 bg-background p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">Reservation</h3>
          <dl className="space-y-3">
            <ReservationDetail label="Date" value={formatDate(reservation.date)} />
            <ReservationDetail label="Time" value={timeRange} />
            <ReservationDetail label={servicePointTerm.singular} value={assignedServicePoint} />
            <ReservationDetail label="Source" value={String(reservation.source || "online").replace("_", " ")} />
          </dl>
        </section>
        <section className="rounded-xl border border-border/70 bg-background p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">Contact</h3>
          <dl className="space-y-3">
            <ReservationDetail label="Phone" value={reservation.phone} />
            <ReservationDetail label="Email" value={reservation.email} />
          </dl>
        </section>
        <section className="rounded-xl border border-border/70 bg-background p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">Special requests</h3>
          <p className={reservation.specialRequest ? "text-sm leading-6 text-foreground" : "text-sm text-muted-foreground"}>
            {reservation.specialRequest || "None provided"}
          </p>
        </section>
        <section className="rounded-xl border border-border/70 bg-background p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">Timeline</h3>
          <dl className="space-y-3">
            <ReservationDetail label="Submitted" value={reservation.createdAt ? new Date(reservation.createdAt).toLocaleString() : "—"} />
            {reservation.arrivedAt && <ReservationDetail label="Arrived" value={new Date(reservation.arrivedAt).toLocaleString()} />}
            {reservation.seatedAt && <ReservationDetail label="Seated" value={new Date(reservation.seatedAt).toLocaleString()} />}
            {reservation.completedAt && <ReservationDetail label="Completed" value={new Date(reservation.completedAt).toLocaleString()} />}
          </dl>
        </section>
      </div>
    )
  }

  function renderMonthCalendar() {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ]
    while (cells.length % 7 !== 0) cells.push(null)

    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <button type="button" aria-label="Previous month" onClick={() => { const next = new Date(calendarDate); next.setMonth(next.getMonth() - 1); setCalendarDate(next) }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="h-5 w-5" /></button>
          <div className="text-center"><h2 className="text-lg font-black text-foreground">{MONTH_NAMES[month]} {year}</h2><button type="button" onClick={() => setCalendarDate(new Date(`${clientToday}T12:00:00`))} className="text-xs font-bold text-primary hover:underline">Go to today</button></div>
          <button type="button" aria-label="Next month" onClick={() => { const next = new Date(calendarDate); next.setMonth(next.getMonth() + 1); setCalendarDate(next) }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {DAY_ABBRS.map((day) => <span key={day} className="py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground">{day}</span>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="min-h-24 border-b border-r border-border/40 bg-muted/10" />
            const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            const dateReservations = reservationsByDate[date] || []
            const statusCounts: Record<string, number> = {}
            dateReservations.forEach((reservation) => { statusCounts[reservation.status] = (statusCounts[reservation.status] || 0) + 1 })
            return (
              <button type="button" key={date} onClick={() => setSelectedDay(date)} className={`min-h-24 border-b border-r border-border/40 p-2 text-left transition-colors hover:bg-muted/30 ${date === clientToday ? "bg-primary/5" : ""}`}>
                <span className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${date === clientToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>{day}</span>
                {dateReservations.length > 3 ? <span className="rounded bg-primary/10 px-1.5 py-1 text-[10px] font-bold text-primary">{dateReservations.length} reservations</span> : <span className="flex flex-wrap gap-1">{Object.entries(statusCounts).flatMap(([status, count]) => Array.from({ length: count }, (_, statusIndex) => <span key={`${status}-${statusIndex}`} className={`h-2 w-2 rounded-full ${STATUS_CONFIG[status]?.dot || "bg-slate-400"}`} />))}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-border bg-muted/20 px-4 py-3">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${config.dot}`} />{config.label}</span>)}
        </div>
      </section>
    )
  }

  function renderDaySchedule() {
    if (!selectedDay) return null
    const dateLabel = new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    const reservationsByServicePoint = new Map<string, ReservationDashboardRecord[]>()
    dayReservations.forEach((reservation) => {
      const key = reservation.servicePointId || "unassigned"
      reservationsByServicePoint.set(key, [...(reservationsByServicePoint.get(key) || []), reservation])
    })

    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setSelectedDay(null)} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to calendar</button>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="text-xl font-black text-foreground">{dateLabel}</h2><p className="mt-1 text-sm text-muted-foreground">{dayReservations.length} {dayReservations.length === 1 ? "reservation" : "reservations"}</p></section>
        {servicePoints.length === 0 ? (
          <section className="rounded-2xl border border-border bg-card p-10 text-center"><CircleDot className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-bold text-foreground">No tables configured</p></section>
        ) : (
          <div className="space-y-3">
            {servicePoints.filter((servicePoint) => servicePoint.isActive !== false && servicePoint.servicePointType !== "room").map((servicePoint) => {
              const assigned = reservationsByServicePoint.get(servicePoint.servicePointId) || []
              return (
                <section key={servicePoint.servicePointId} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="grid gap-3 p-4 sm:grid-cols-[10rem_1fr] sm:items-center">
                    <div><p className="font-black text-foreground">{servicePoint.label}</p>{servicePoint.capacity && <p className="mt-1 text-xs text-muted-foreground">Seats {servicePoint.capacity}</p>}</div>
                    {assigned.length === 0 ? <p className="flex items-center gap-2 text-sm font-bold text-emerald-600"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Available</p> : <div className="space-y-2">{assigned.map((reservation) => <div key={reservation._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5"><div><p className="text-sm font-black text-foreground">{reservation.customerName}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatTime(reservation.startTime)} · {reservation.guestCount} guests</p></div><div className="flex items-center gap-2"><ReservationStatusBadge mode="timeslot" status={reservation.status} />{renderReservationActions(reservation)}</div></div>)}</div>}
                  </div>
                </section>
              )
            })}
            {(reservationsByServicePoint.get("unassigned") || []).length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20"><h3 className="mb-3 font-black text-amber-800 dark:text-amber-200">Unassigned reservations</h3><div className="space-y-2">{(reservationsByServicePoint.get("unassigned") || []).map((reservation) => <div key={reservation._id} className="flex items-center justify-between gap-3 rounded-xl bg-background p-3"><span><span className="block text-sm font-bold text-foreground">{reservation.customerName}</span><span className="text-xs text-muted-foreground">{formatTime(reservation.startTime)} · {reservation.guestCount} guests</span></span>{renderReservationActions(reservation)}</div>)}</div></section>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-foreground"><CalendarDays className="h-6 w-6 shrink-0 text-primary" />Reservations</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">Manage restaurant reservations, arrivals and seating</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManageOperationalSettings && <button type="button" onClick={toggleReservations} disabled={isLoading || isTogglingReservations} title={reservationsEnabled ? "Online reservations are accepting bookings" : "Online reservations are paused"} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60">{isTogglingReservations ? <Loader2 className="h-4 w-4 animate-spin" /> : reservationsEnabled ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4 text-red-500" />}<span className="hidden md:inline">Online Reservations</span><span className={reservationsEnabled ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{reservationsEnabled ? "On" : "Off"}</span></button>}
            {canManageReservations && <button type="button" onClick={() => openStaffDialog("reservation")} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New Reservation</span></button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
        {deepLinkError ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="status">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {deepLinkError}
          </div>
        ) : null}
        {viewMode === "today" && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Expected Today", value: stats.expectedToday?.total || 0, detail: `${stats.expectedToday?.upcoming || 0} upcoming`, icon: Users, color: "bg-blue-50 text-blue-600 dark:bg-blue-950/30" },
              { label: "Arrived", value: stats.arrivedToday?.total || 0, detail: `${stats.arrivedToday?.percent || 0}% of expected`, icon: UserCheck, color: "bg-orange-50 text-orange-600 dark:bg-orange-950/30" },
              { label: "Seated Now", value: stats.seatedNow?.reservations || 0, detail: `${stats.seatedNow?.guests || 0} guests`, icon: Armchair, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" },
              { label: "Available Tonight", value: stats.tableAvailability?.available || 0, detail: `of ${stats.tableAvailability?.total || 0} tables`, icon: LayoutGrid, color: "bg-violet-50 text-violet-600 dark:bg-violet-950/30" },
            ].map(({ label, value, detail, icon: Icon, color }) => (
              <section key={label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block truncate text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</span>{isLoading ? <Skeleton className="mt-1 h-7 w-12" /> : <span className="block text-2xl font-black leading-tight text-foreground">{value}</span>}<span className="block truncate text-[10px] text-muted-foreground">{detail}</span></span></section>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-1 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex items-center gap-1" aria-label="Reservation views">
            {([{ id: "today", label: "Today", icon: CalendarDays }, { id: "calendar", label: "Calendar", icon: Calendar }, { id: "all", label: "All Reservations", icon: LayoutList }] as const).map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => { if (id === "today") setOperationalDate(""); setViewMode(id); setSelectedDay(null) }} className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${viewMode === id ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
          </nav>
          {viewMode === "today" && <div className="flex items-center justify-between gap-2 px-1 sm:justify-end"><button type="button" onClick={() => setOperationalDate(addReservationDateDays(selectedOperationalDate, -1))} aria-label="Previous day" className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setOperationalDate("")} className="min-w-52 rounded-lg px-3 py-2 text-center text-xs font-bold text-foreground hover:bg-card">{!operationalDate ? "Today · " : ""}{formattedOperationalDate}</button><button type="button" onClick={() => setOperationalDate(addReservationDateDays(selectedOperationalDate, 1))} aria-label="Next day" className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"><ChevronRight className="h-4 w-4" /></button></div>}
        </div>

        {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        {viewMode === "today" && !error && <RestaurantTodayView reservations={operations.reservations} needsAttention={operations.needsAttention} servicePoints={servicePoints} stats={stats} isLoading={isLoading} renderActions={renderReservationActions} onOpenReservation={openReservationInAllView} onViewAll={() => { setFilterDate(""); setFilterStatus("all"); setViewMode("all") }} onAddReservation={() => openStaffDialog("reservation")} onAddWalkIn={() => openStaffDialog("walk_in")} onViewTableSchedule={() => { setCalendarDate(new Date(`${selectedOperationalDate}T12:00:00`)); setSelectedDay(selectedOperationalDate); setViewMode("calendar") }} />}

        {viewMode === "calendar" && (isLoading ? <ReservationContentSkeleton view="calendar" /> : error ? null : selectedDay ? renderDaySchedule() : renderMonthCalendar())}

        {viewMode === "all" && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><input type="search" aria-label="Search reservations" placeholder="Search by name, phone or email" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" /></label>
                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 sm:w-48"><CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" /><input type="date" aria-label="Filter reservations by date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" /></label>
                <div className="relative sm:w-48"><select aria-label="Filter reservations by status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="h-full w-full appearance-none rounded-xl border border-border bg-background px-3 py-2 pr-8 text-sm font-medium text-foreground outline-none"><option value="all">All Statuses</option><option value="pending">Pending</option><option value="confirmed">Expected</option><option value="arrived">Arrived</option><option value="seated">Seated</option><option value="completed">Completed</option><option value="no_show">No Show</option><option value="cancelled">Cancelled</option><option value="declined">Declined</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></div>
              </div>
              {(filterDate || filterStatus !== "all" || searchQuery) && <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground"><span>Showing <strong className="text-foreground">{filtered.length}</strong> of {pagination.totalCount}</span><button type="button" onClick={() => { setFilterDate(""); setFilterStatus("all"); setSearchQuery("") }} className="font-bold text-primary hover:underline">Clear filters</button></div>}
            </div>

            {isLoading ? <ReservationContentSkeleton view="list" /> : error ? null : filtered.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center shadow-sm"><Calendar className="mb-3 h-9 w-9 text-muted-foreground" /><h2 className="text-lg font-black text-foreground">{reservations.length === 0 ? "No Reservations Yet" : "No Results Found"}</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">{reservations.length === 0 ? `When guests reserve a ${servicePointTerm.lower}, the booking will appear here.` : "Try adjusting the current filters."}</p></div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="hidden grid-cols-[1.25fr_1.35fr_.65fr_1fr_1fr_auto] gap-4 border-b border-border bg-muted/30 px-5 py-3 lg:grid">{["Guest", "Date & Time", "Party", "Table", "Status", "Actions"].map((heading) => <span key={heading} className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{heading}</span>)}</div>
                <div className="divide-y divide-border/60">
                  {filtered.map((reservation) => {
                    const isExpanded = expandedId === reservation._id
                    return <article key={reservation._id} className="hover:bg-muted/20"><div className="grid gap-3 px-5 py-4 lg:grid-cols-[1.25fr_1.35fr_.65fr_1fr_1fr_auto] lg:items-center"><button type="button" onClick={() => setExpandedId(isExpanded ? null : reservation._id)} className="text-left font-black text-foreground hover:text-primary hover:underline">{reservation.customerName}</button><div><p className="text-sm font-bold text-foreground">{formatDate(reservation.date)}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{reservation.startTime && reservation.endTime ? `${formatTime(reservation.startTime)} – ${formatTime(reservation.endTime)}` : formatTime(reservation.time)}{isToday(reservation.date) && <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">Today</span>}</p></div><span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Users className="h-4 w-4 text-muted-foreground" />{reservation.guestCount}</span><span className="text-sm font-semibold text-foreground">{reservation.servicePointLabel || "—"}</span><span><ReservationStatusBadge mode="timeslot" status={reservation.status} /></span><span className="flex items-center gap-1">{renderReservationActions(reservation)}<button type="button" onClick={() => setExpandedId(isExpanded ? null : reservation._id)} aria-expanded={isExpanded} aria-label={`${isExpanded ? "Collapse" : "Expand"} reservation for ${reservation.customerName || "guest"}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} /></button></span></div>{isExpanded && <div className="border-t border-border/50 bg-muted/10 px-5 pb-5">{renderExpandedDetails(reservation)}</div>}</article>
                  })}
                </div>
                {(pagination.hasPreviousPage || pagination.hasNextPage) && <div className="flex items-center justify-between border-t border-border bg-muted/10 px-5 py-4"><button type="button" disabled={!pagination.hasPreviousPage || isLoading} onClick={() => { setListCursor(null); setPreviousCursor(pagination.previousCursor) }} className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold disabled:opacity-50">← Previous</button><span className="text-xs text-muted-foreground">Showing {filtered.length} of {pagination.totalCount}</span><button type="button" disabled={!pagination.hasNextPage || isLoading} onClick={() => { setPreviousCursor(null); setListCursor(pagination.nextCursor) }} className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold disabled:opacity-50">Next →</button></div>}
              </div>
            )}
          </>
        )}
      </main>

      {canManageReservations && (
        <>
          <StaffRestaurantReservationDialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen} mode={staffDialogMode} businessDate={selectedOperationalDate} timezone={timezone} onCreated={() => refreshActiveView(true)} />
          <ReservationDeleteDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} isBusy={Boolean(actionLoadingId)} isDeleting={Boolean(actionLoadingId && deletingReservationId)} />
        </>
      )}
    </div>
  )
}
