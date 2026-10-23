"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Armchair,
  CalendarPlus,
  ChevronRight,
  ListChecks,
  MessageSquareText,
  Sparkles,
  UsersRound,
} from "lucide-react"
import { formatReservationTime as formatTime } from "@/lib/reservation-date"
import { ReservationStatusBadge } from "../ReservationStatusBadge"
import type {
  ReservationDashboardRecord,
  ReservationDashboardServicePoint,
} from "../useReservationDashboard"

type AttentionReservation = ReservationDashboardRecord & {
  attentionReason?: "late" | "pending_confirmation" | "awaiting_seating"
  minutesLate?: number
}

function servicePointLabel(reservation: ReservationDashboardRecord) {
  return reservation.servicePointLabel || "Unassigned"
}

function attentionLabel(reservation: AttentionReservation) {
  if (reservation.attentionReason === "late") {
    return `${reservation.minutesLate || 0} min late`
  }
  if (reservation.attentionReason === "awaiting_seating") {
    return "Waiting to be seated"
  }
  return "Pending confirmation"
}

function AvailabilityRing({ available, total }: { available: number; total: number }) {
  const percent = total > 0 ? Math.round((available / total) * 100) : 0
  return (
    <div className="relative h-28 w-28 shrink-0" aria-label={`${available} of ${total} tables available`}>
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
        <circle
          cx="21"
          cy="21"
          r="15.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${percent} ${100 - percent}`}
          strokeDashoffset="25"
          strokeLinecap="round"
          className="text-primary"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-foreground">{available}</span>
        <span className="text-[10px] font-semibold text-muted-foreground">Available</span>
      </div>
    </div>
  )
}

export function RestaurantTodayView({
  reservations,
  needsAttention,
  servicePoints,
  stats,
  isLoading,
  renderActions,
  onOpenReservation,
  onViewAll,
  onAddReservation,
  onAddWalkIn,
  onViewTableSchedule,
}: {
  reservations: ReservationDashboardRecord[]
  needsAttention: AttentionReservation[]
  servicePoints: ReservationDashboardServicePoint[]
  stats: any
  isLoading: boolean
  renderActions: (reservation: ReservationDashboardRecord) => ReactNode
  onOpenReservation: (reservation: ReservationDashboardRecord) => void
  onViewAll: () => void
  onAddReservation: () => void
  onAddWalkIn: () => void
  onViewTableSchedule: () => void
}) {
  const [statusFilter, setStatusFilter] = useState("all")
  const filteredReservations = useMemo(
    () => statusFilter === "all"
      ? reservations
      : reservations.filter((reservation) => reservation.status === statusFilter),
    [reservations, statusFilter],
  )
  const availability = stats.tableAvailability || {}
  const activeServicePoints = servicePoints.filter(
    (servicePoint) => servicePoint.isActive !== false && servicePoint.servicePointType !== "room",
  )

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-orange-200/80 bg-orange-50/50 dark:border-orange-900/60 dark:bg-orange-950/15">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-black text-orange-700 dark:text-orange-300">
            <AlertTriangle className="h-4 w-4" />
            Needs Attention ({needsAttention.length})
          </div>
          {needsAttention.length > 0 && (
            <button type="button" onClick={onViewAll} className="text-xs font-bold text-primary hover:underline">
              View all
            </button>
          )}
        </div>
        {needsAttention.length === 0 ? (
          <div className="border-t border-orange-200/60 px-4 py-4 text-sm text-muted-foreground dark:border-orange-900/50">
            No late arrivals or pending confirmations right now.
          </div>
        ) : (
          <div className="divide-y divide-orange-200/60 border-t border-orange-200/60 dark:divide-orange-900/50 dark:border-orange-900/50">
            {needsAttention.slice(0, 3).map((reservation) => (
              <button
                type="button"
                key={reservation._id}
                onClick={() => onOpenReservation(reservation)}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-orange-100/60 dark:hover:bg-orange-950/30"
              >
                <span className="text-xs font-black text-orange-700 dark:text-orange-300">
                  {formatTime(reservation.startTime || reservation.time)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">{reservation.customerName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {reservation.guestCount} guests · {servicePointLabel(reservation)} · {attentionLabel(reservation)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-black text-foreground">Today&apos;s Reservations</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Live arrival and seating workflow</p>
            </div>
            <select
              aria-label="Filter today's reservations by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Expected</option>
              <option value="arrived">Arrived</option>
              <option value="seated">Seated</option>
              <option value="completed">Completed</option>
              <option value="no_show">No show</option>
            </select>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-5" aria-label="Loading today's reservations">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
              <CalendarPlus className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-bold text-foreground">No reservations in this view</p>
              <p className="mt-1 text-sm text-muted-foreground">New bookings and walk-ins will appear here.</p>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[0.7fr_1.25fr_0.55fr_0.85fr_0.9fr_1.2fr_auto] gap-3 border-b border-border bg-muted/30 px-5 py-2.5 lg:grid">
                {['Time', 'Guest', 'Party', 'Table', 'Status', 'Notes', ''].map((heading, index) => (
                  <span key={`${heading}-${index}`} className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{heading}</span>
                ))}
              </div>
              <div className="divide-y divide-border/60">
                {filteredReservations.map((reservation) => (
                  <div key={reservation._id} className="border-l-[3px] border-l-primary/70 px-4 py-3.5 transition-colors hover:bg-muted/20 sm:px-5">
                    <div className="grid gap-3 lg:grid-cols-[0.7fr_1.25fr_0.55fr_0.85fr_0.9fr_1.2fr_auto] lg:items-center">
                      <span className="text-sm font-black text-foreground">{formatTime(reservation.startTime || reservation.time)}</span>
                      <button type="button" onClick={() => onOpenReservation(reservation)} className="text-left text-sm font-bold text-foreground hover:text-primary hover:underline">
                        {reservation.customerName}
                      </button>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground"><UsersRound className="h-3.5 w-3.5" />{reservation.guestCount}</span>
                      <span className="text-sm font-semibold text-foreground">{servicePointLabel(reservation)}</span>
                      <span><ReservationStatusBadge mode="timeslot" status={reservation.status} /></span>
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {reservation.specialRequest ? <MessageSquareText className="h-3.5 w-3.5 shrink-0" /> : null}
                        <span className="truncate">{reservation.specialRequest || "—"}</span>
                      </span>
                      <span>{renderActions(reservation)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={onViewAll} className="flex items-center gap-2 px-5 py-4 text-xs font-bold text-primary hover:underline">
                View all reservations <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-black text-foreground">Service point Availability</h2>
              <button type="button" onClick={onViewTableSchedule} className="text-xs font-bold text-primary hover:underline">View schedule</button>
            </div>
            <div className="flex items-center gap-5">
              <AvailabilityRing available={availability.available || 0} total={availability.total || activeServicePoints.length} />
              <dl className="min-w-0 flex-1 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" />Occupied</dt><dd className="font-black text-foreground">{availability.occupied || 0}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-amber-400" />Reserved later</dt><dd className="font-black text-foreground">{availability.reservedLater || 0}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" />Available now</dt><dd className="font-black text-foreground">{availability.available || 0}</dd></div>
                <div className="border-t border-border pt-2 flex items-center justify-between gap-3"><dt className="font-semibold text-muted-foreground">Total service points</dt><dd className="font-black text-foreground">{availability.total || activeServicePoints.length}</dd></div>
              </dl>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 font-black text-foreground">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onAddReservation} className="rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                <CalendarPlus className="mb-2 h-5 w-5 text-primary" />
                <span className="block text-xs font-black text-foreground">New Reservation</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">Book a table</span>
              </button>
              <button type="button" onClick={onAddWalkIn} className="rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                <UsersRound className="mb-2 h-5 w-5 text-primary" />
                <span className="block text-xs font-black text-foreground">Add Walk-In</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">Seat a guest now</span>
              </button>
              <Link href="/owner/service-points" className="rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                <Armchair className="mb-2 h-5 w-5 text-primary" />
                <span className="block text-xs font-black text-foreground">Manage Service points</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">View and manage</span>
              </Link>
              <button type="button" onClick={onViewAll} className="rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                <ListChecks className="mb-2 h-5 w-5 text-primary" />
                <span className="block text-xs font-black text-foreground">All Reservations</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">Search every booking</span>
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-orange-200/70 bg-orange-50/50 p-4 dark:border-orange-900/60 dark:bg-orange-950/15">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-black text-primary">Quiet Period</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {stats.nextBusyTime
                    ? `Next busy period starts at ${formatTime(stats.nextBusyTime)}.`
                    : "No more expected arrivals are scheduled today."}
                  {` ${availability.available || 0} tables are available right now.`}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
