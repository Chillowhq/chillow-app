"use client"

import Link from "next/link"
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  DollarSign,
  DoorOpen,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react"
import GuidedSetupChecklist, { type SetupProgress } from "@/components/owner/GuidedSetupChecklist"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/localization"
import type { HotelDashboardPayload } from "@/types/owner-dashboard"

type Props = {
  data: HotelDashboardPayload
  userName: string
  loading: boolean
  onRefresh: () => void
  setupProgress: SetupProgress | null
  setupCollapsed: boolean
  dismissingSetup: boolean
  onToggleSetup: () => void
  onDismissSetup: () => void
}

const severityClasses = {
  error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300",
}

function formatCents(cents: number, currency: string | null) {
  return formatPrice(cents / 100, currency || "EUR")
}

function formatBusinessDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`))
}

function HotelKpiCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  detail: string
  href?: string
  icon: typeof CalendarDays
  tone: string
}) {
  const content = (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors">
      <div className={`flex size-10 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></div>
      <div className="mt-auto"><p className="text-2xl font-black text-foreground">{value}</p><p className="mt-1 text-sm font-semibold text-foreground">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
    </div>
  )
  return href ? <Link href={href} className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:[&>div]:border-primary/40">{content}</Link> : content
}

function RestrictedCard({ label, icon: Icon }: { label: string; icon: typeof CalendarDays }) {
  return <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-5" /></div><div className="mt-auto"><p className="text-sm font-black text-foreground">{label}</p><p className="mt-1 text-xs text-muted-foreground">Not available for your role.</p></div></div>
}

export function HotelDashboard({
  data,
  userName,
  loading,
  onRefresh,
  setupProgress,
  setupCollapsed,
  dismissingSetup,
  onToggleSetup,
  onDismissSetup,
}: Props) {
  const { access, operations, housekeeping, financialSummary, foodService } = data
  const quickActions = [
    access.reservations ? { href: "/owner/reservations", label: "Hotel bookings", icon: CalendarDays } : null,
    access.housekeeping ? { href: "/housekeeping", label: "Housekeeping", icon: Sparkles } : null,
    access.servicePoints ? { href: "/owner/service-points?view=rooms", label: "Room setup", icon: DoorOpen } : null,
    access.transactions ? { href: "/owner/transactions", label: "Payments", icon: DollarSign } : null,
    access.staff ? { href: "/owner/staff", label: "Staff", icon: Users } : null,
    access.billing ? { href: "/owner/billing", label: "Billing", icon: CreditCard } : null,
  ].filter(Boolean) as { href: string; label: string; icon: typeof CalendarDays }[]

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <PageHeader className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6" title="Hotel Dashboard" titleClassName="text-xl tracking-normal" description={`${formatBusinessDate(data.businessDate)} · ${data.timezone}`} descriptionClassName="mt-0 text-xs" action={<Button type="button" size="icon" variant="outline" onClick={onRefresh} disabled={loading} title="Refresh hotel dashboard" aria-label="Refresh hotel dashboard"><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /></Button>} />
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-card to-card p-6 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Hotel overview</p><h1 className="mt-1 text-2xl font-black text-foreground">Welcome back, {userName}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">See arrivals, departures, room status, and the work that needs attention today.</p></section>

        {setupProgress && !setupProgress.dismissed ? <GuidedSetupChecklist progress={setupProgress} collapsed={setupCollapsed} dismissing={dismissingSetup} onToggleCollapsed={onToggleSetup} onDismiss={onDismissSetup} /> : null}

        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Today&apos;s hotel snapshot</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {operations ? <HotelKpiCard label="Arrivals today" value={String(operations.arrivals.scheduled)} detail={operations.arrivals.remaining ? `${operations.arrivals.remaining} still to check in` : "All arrivals checked in"} href="/owner/reservations" icon={CalendarDays} tone="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400" /> : <RestrictedCard label="Arrivals today" icon={CalendarDays} />}
            {operations ? <HotelKpiCard label="Departures today" value={String(operations.departures.scheduled)} detail={operations.departures.remaining ? `${operations.departures.remaining} still to check out` : "All departures checked out"} href="/owner/reservations" icon={DoorOpen} tone="bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400" /> : <RestrictedCard label="Departures today" icon={DoorOpen} />}
            {operations ? <HotelKpiCard label="Rooms currently occupied" value={String(operations.roomInventory.occupiedRooms)} detail={`${operations.roomInventory.eligibleRooms} eligible rooms`} href="/owner/reservations" icon={BedDouble} tone="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400" /> : <RestrictedCard label="Rooms currently occupied" icon={BedDouble} />}
            {housekeeping ? <HotelKpiCard label="Rooms needing cleaning" value={String(housekeeping.roomsNeedingCleaning)} detail={housekeeping.urgentTasks ? `${housekeeping.urgentTasks} urgent task${housekeeping.urgentTasks === 1 ? "" : "s"}` : "Housekeeping queue"} href="/housekeeping" icon={Sparkles} tone="bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" /> : <RestrictedCard label="Rooms needing cleaning" icon={Sparkles} />}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="text-sm font-black text-foreground">Needs attention</h2><p className="mt-1 text-xs text-muted-foreground">Important items from reservations, housekeeping, and billing.</p>{data.actionItems.length ? <div className="mt-5 space-y-2">{data.actionItems.map((item) => <Link key={`${item.type}-${item.message}`} href={item.href} className={`flex items-start gap-3 rounded-xl border p-3 text-sm font-semibold outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary ${severityClasses[item.severity]}`}><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{item.message}</span></Link>)}</div> : <div className="mt-6 flex flex-col items-center py-5 text-center"><CheckCircle2 className="size-8 text-emerald-500" /><p className="mt-2 text-sm font-bold text-foreground">You&apos;re all caught up.</p><p className="mt-1 text-xs text-muted-foreground">No authorized issues need attention right now.</p></div>}</section>
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2"><h2 className="text-sm font-black text-foreground">Today&apos;s hotel operations</h2>{operations ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-2xl font-black text-foreground">{operations.arrivals.checkedIn}/{operations.arrivals.scheduled}</p><p className="text-xs text-muted-foreground">Arrivals checked in</p></div><div><p className="text-2xl font-black text-foreground">{operations.departures.checkedOut}/{operations.departures.scheduled}</p><p className="text-xs text-muted-foreground">Departures checked out</p></div><div><p className="text-2xl font-black text-foreground">{operations.roomInventory.eligibleRooms}</p><p className="text-xs text-muted-foreground">Eligible room inventory</p></div><div><p className="text-2xl font-black text-foreground">{operations.roomInventory.notCurrentlyOccupiedRooms}</p><p className="text-xs text-muted-foreground">Not currently occupied</p></div></div> : <p className="mt-5 text-sm text-muted-foreground">Reservation operations are not available for your role.</p>}{housekeeping ? <div className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground"><span className="font-bold text-foreground">Housekeeping:</span> {housekeeping.roomsNeedingCleaning} need cleaning · {housekeeping.urgentTasks} urgent · {housekeeping.unresolvedInventoryExceptions} inventory exception{housekeeping.unresolvedInventoryExceptions === 1 ? "" : "s"}</div> : null}</section>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2"><h2 className="text-sm font-black text-foreground">Hotel financial summary</h2><p className="mt-1 text-xs text-muted-foreground">Verified reservation payments collected during the hotel&apos;s local calendar day.</p>{financialSummary ? <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><p className="text-2xl font-black text-foreground">{formatCents(financialSummary.paidBookingRevenueCents, data.currency)}</p><p className="text-xs text-muted-foreground">Paid booking revenue</p></div><div><p className="text-2xl font-black text-foreground">{financialSummary.paidBookingCount}</p><p className="text-xs text-muted-foreground">Paid bookings</p></div><div><p className="text-2xl font-black text-foreground">{financialSummary.pendingReservationPaymentCount ?? "—"}</p><p className="text-xs text-muted-foreground">Active pending payments</p></div></div> : <p className="mt-5 text-sm text-muted-foreground">Financial information is not available for your role.</p>}</section>
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="text-sm font-black text-foreground">Quick actions</h2><div className="mt-4 grid grid-cols-2 gap-2">{quickActions.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-border p-3 text-center text-xs font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"><Icon className="size-4 text-primary" />{label}</Link>)}</div>{quickActions.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No additional workspaces are available for your role.</p> : null}</section>
        </div>

        {foodService ? <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-2"><DollarSign className="size-4 text-primary" /><h2 className="text-sm font-black text-foreground">Food service</h2></div><p className="mt-1 text-xs text-muted-foreground">This is separate from hotel booking revenue.</p><div className="mt-5 grid grid-cols-3 gap-4"><div><p className="text-2xl font-black text-foreground">{foodService.todayOrders ?? "—"}</p><p className="text-xs text-muted-foreground">Orders today</p></div><div><p className="text-2xl font-black text-foreground">{foodService.activeOrders ?? "—"}</p><p className="text-xs text-muted-foreground">Active orders</p></div><div><p className="text-2xl font-black text-foreground">{foodService.paidRevenueCents === null ? "—" : formatCents(foodService.paidRevenueCents, data.currency)}</p><p className="text-xs text-muted-foreground">Paid food revenue</p></div></div></section> : null}
      </main>
    </div>
  )
}
