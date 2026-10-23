"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Armchair,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/axios-config"
import { getBusinessLocalReservationDate } from "@/lib/reservation-date"
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
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export type StaffRestaurantReservationMode = "reservation" | "walk_in"

interface RestaurantAvailabilityServicePoint {
  servicePointId: string
  label?: string | null
  servicePointType: string
  capacity: number | null
}

interface RestaurantAvailability {
  date: string | null
  month: string | null
  businessTimezone: string
  businessLocalDate: string
  businessLocalTime: string
  durationMinutes: number
  reason: string | null
  availableDates: string[]
  availableStartTimes: string[]
  validEndTimes: string[]
  servicePoints: RestaurantAvailabilityServicePoint[]
  noPreferenceAvailable: boolean
  selectedServicePointAvailable: boolean
}

const DEFAULT_DURATION_MINUTES = 90
const AUTO_ASSIGN_VALUE = "__auto_assign__"
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function initialForm({
  mode,
  businessDate,
  timezone,
}: {
  mode: StaffRestaurantReservationMode
  businessDate: string
  timezone: string
}) {
  const today = getBusinessLocalReservationDate(timezone)
  const date = mode === "walk_in" || businessDate < today ? today : businessDate
  return {
    customerName: "",
    phone: "",
    email: "",
    date,
    startTime: "",
    endTime: "",
    durationMinutes: DEFAULT_DURATION_MINUTES,
    guestCount: 2,
    servicePointId: "",
    specialRequest: "",
  }
}

function parseMonth(value: string) {
  const [year, month] = value.split("-").map(Number)
  return { year, month }
}

function shiftMonth(value: string, amount: number) {
  const { year, month } = parseMonth(value)
  const index = (year * 12) + month - 1 + amount
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`
}

function monthLabel(value: string) {
  const { year, month } = parseMonth(value)
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1, 12))
}

function dateLabel(value: string) {
  if (!value) return "Choose a date"
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12))
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes))
}

function durationBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number)
  const [endHour, endMinute] = endTime.split(":").map(Number)
  return ((endHour * 60) + endMinute) - ((startHour * 60) + startMinute)
}

function availabilityMessage(reason: string | null) {
  switch (reason) {
    case "closed":
      return "The restaurant is closed on this date. Choose another available day."
    case "past_date":
      return "This date has passed in the restaurant's local timezone."
    case "no_service_point_can_fit_party":
      return "No active restaurant service point can accommodate this party size."
    case "no_available_times":
      return "No times are currently available for this date and selection."
    default:
      return null
  }
}

export function StaffRestaurantReservationDialog({
  open,
  onOpenChange,
  mode,
  businessDate,
  timezone,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: StaffRestaurantReservationMode
  businessDate: string
  timezone: string
  onCreated: () => void | Promise<void>
}) {
  const [form, setForm] = useState(() => initialForm({ mode, businessDate, timezone }))
  const reservationAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null)
  const [availability, setAvailability] = useState<RestaurantAvailability | null>(null)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(form.date.slice(0, 7))
  const [refreshVersion, setRefreshVersion] = useState(0)
  const isWalkIn = mode === "walk_in"

  useEffect(() => {
    if (!open) return
    const nextForm = initialForm({ mode, businessDate, timezone })
    setForm(nextForm)
    setCalendarMonth(nextForm.date.slice(0, 7))
    setAvailability(null)
    setAvailabilityError(null)
    setError(null)
  }, [open, mode, businessDate, timezone])

  useEffect(() => {
    if (!open || !form.date || form.guestCount < 1) return

    const controller = new AbortController()
    setAvailabilityLoading(true)
    setAvailabilityError(null)

    apiClient.get<RestaurantAvailability>("/owner/reservations/restaurant-availability", {
      signal: controller.signal,
      params: {
        date: form.date,
        month: calendarMonth,
        partySize: form.guestCount,
        durationMinutes: form.durationMinutes,
        ...(form.startTime ? { startTime: form.startTime } : {}),
        ...(form.servicePointId ? { servicePointId: form.servicePointId } : {}),
        ...(isWalkIn ? { mode: "walk_in" } : {}),
      },
    })
      .then(({ data }) => {
        setAvailability(data)
        setForm((current) => {
          const startTime = current.startTime && data.availableStartTimes.includes(current.startTime)
            ? current.startTime
            : ""
          const endTime = startTime && current.endTime && data.validEndTimes.includes(current.endTime)
            ? current.endTime
            : ""
          const servicePointId = current.servicePointId && data.selectedServicePointAvailable
            ? current.servicePointId
            : ""
          return { ...current, startTime, endTime, servicePointId }
        })
      })
      .catch((requestError: any) => {
        if (requestError?.code === "ERR_CANCELED") return
        setAvailability(null)
        setAvailabilityError(
          requestError.response?.data?.error || "Availability could not be loaded.",
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false)
      })

    return () => controller.abort()
  }, [
    open,
    isWalkIn,
    calendarMonth,
    form.date,
    form.durationMinutes,
    form.guestCount,
    form.servicePointId,
    form.startTime,
    refreshVersion,
  ])

  const calendarDays = useMemo(() => {
    const { year, month } = parseMonth(calendarMonth)
    const firstWeekday = new Date(year, month - 1, 1, 12).getDay()
    const daysInMonth = new Date(year, month, 0, 12).getDate()
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1
        return `${calendarMonth}-${String(day).padStart(2, "0")}`
      }),
    ]
  }, [calendarMonth])

  const validDates = useMemo(
    () => new Set(availability?.availableDates || []),
    [availability?.availableDates],
  )
  const statusMessage = availabilityMessage(availability?.reason || null)

  function updateTextField(
    field: "customerName" | "phone" | "email" | "specialRequest",
    value: string,
  ) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updatePartySize(amount: number) {
    setForm((current) => ({
      ...current,
      guestCount: Math.min(50, Math.max(1, current.guestCount + amount)),
      startTime: "",
      endTime: "",
    }))
  }

  function selectDate(date: string) {
    setForm((current) => ({ ...current, date, startTime: "", endTime: "" }))
    setCalendarOpen(false)
  }

  function selectStartTime(startTime: string) {
    setForm((current) => ({
      ...current,
      startTime,
      endTime: "",
      durationMinutes: DEFAULT_DURATION_MINUTES,
    }))
  }

  function selectEndTime(endTime: string) {
    setForm((current) => ({
      ...current,
      endTime,
      durationMinutes: durationBetween(current.startTime, endTime),
    }))
  }

  function selectServicePoint(value: string) {
    setForm((current) => ({
      ...current,
      servicePointId: value === AUTO_ASSIGN_VALUE ? "" : value,
      endTime: "",
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!availability || availabilityLoading) {
      setError("Wait for current availability before creating the reservation.")
      return
    }
    if (!form.startTime || !form.endTime) {
      setError("Choose an available start and end time.")
      return
    }
    if (!availability.availableStartTimes.includes(form.startTime) || !availability.validEndTimes.includes(form.endTime)) {
      setError("The selected time is no longer available. Choose another time.")
      setRefreshVersion((version) => version + 1)
      return
    }
    if (isWalkIn && !form.servicePointId) {
      setError("Choose where the walk-in guest will be seated.")
      return
    }
    if (!form.servicePointId && !availability.noPreferenceAvailable) {
      setError("No service point can currently accommodate this reservation.")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        durationMinutes: durationBetween(form.startTime, form.endTime),
        guestCount: form.guestCount,
        seatingPreference: "no_preference",
        servicePointId: form.servicePointId || null,
        specialRequest: form.specialRequest.trim(),
        seatNow: isWalkIn,
      }
      const fingerprint = JSON.stringify(payload)
      if (reservationAttemptRef.current?.fingerprint !== fingerprint) {
        reservationAttemptRef.current = {
          fingerprint,
          key: `restaurant:${crypto.randomUUID()}`,
        }
      }
      await apiClient.post("/owner/reservations", payload, {
        headers: { "Idempotency-Key": reservationAttemptRef.current.key },
      })
      toast.success(isWalkIn ? "Walk-in guest seated." : "Reservation created and confirmed.")
      onOpenChange(false)
      await onCreated()
    } catch (requestError: any) {
      if (requestError.response?.status === 409) {
        setError("That time or service point was just taken. Your guest details are preserved; choose a new valid option.")
        setForm((current) => ({ ...current, endTime: "" }))
        setRefreshVersion((version) => version + 1)
      } else {
        setError(requestError.response?.data?.error || "Failed to create the reservation.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {isWalkIn ? <Armchair className="h-5 w-5" /> : <CalendarPlus className="h-5 w-5" />}
          </div>
          <DialogTitle>{isWalkIn ? "Add Walk-In" : "New Reservation"}</DialogTitle>
          <DialogDescription>
            {isWalkIn
              ? "Add the guest and seat them immediately using current availability."
              : "Create a confirmed reservation using current restaurant availability."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="restaurant-guest-name">Guest name</Label>
              <Input
                id="restaurant-guest-name"
                value={form.customerName}
                onChange={(event) => updateTextField("customerName", event.target.value)}
                placeholder="Full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label id="restaurant-party-size-label">Party size</Label>
              <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-1 shadow-xs" aria-labelledby="restaurant-party-size-label">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => updatePartySize(-1)}
                  disabled={form.guestCount <= 1 || submitting}
                  aria-label="Decrease party size"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <output className="min-w-24 text-center text-sm font-semibold" aria-live="polite">
                  {form.guestCount} {form.guestCount === 1 ? "guest" : "guests"}
                </output>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => updatePartySize(1)}
                  disabled={form.guestCount >= 50 || submitting}
                  aria-label="Increase party size"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="restaurant-phone">Phone</Label>
              <Input
                id="restaurant-phone"
                type="tel"
                value={form.phone}
                onChange={(event) => updateTextField("phone", event.target.value)}
                placeholder="Guest phone number"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="restaurant-email">Email</Label>
              <Input
                id="restaurant-email"
                type="email"
                value={form.email}
                onChange={(event) => updateTextField("email", event.target.value)}
                placeholder="guest@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                    disabled={isWalkIn || submitting}
                    aria-label={`Reservation date: ${dateLabel(form.date)}`}
                  >
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{dateLabel(form.date)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[min(21rem,calc(100vw-2rem))] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Button type="button" size="icon" variant="ghost" onClick={() => setCalendarMonth((month) => shiftMonth(month, -1))} aria-label="Previous month">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <p className="font-semibold" aria-live="polite">{monthLabel(calendarMonth)}</p>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setCalendarMonth((month) => shiftMonth(month, 1))} aria-label="Next month">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {WEEKDAY_LABELS.map((label) => (
                      <span key={label} className="py-1 text-xs font-medium text-muted-foreground" aria-hidden="true">{label}</span>
                    ))}
                    {calendarDays.map((date, index) => date ? (
                      <button
                        key={date}
                        type="button"
                        className="flex h-9 items-center justify-center rounded-md text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30 data-[selected=true]:bg-primary data-[selected=true]:font-semibold data-[selected=true]:text-primary-foreground"
                        disabled={availabilityLoading || !validDates.has(date)}
                        data-selected={date === form.date}
                        aria-label={dateLabel(date)}
                        aria-pressed={date === form.date}
                        onClick={() => selectDate(date)}
                      >
                        {Number(date.slice(-2))}
                      </button>
                    ) : <span key={`blank-${index}`} />)}
                  </div>
                  {availabilityLoading && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" role="status">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking dates…
                    </p>
                  )}
                </PopoverContent>
              </Popover>
              {isWalkIn && <p className="text-xs text-muted-foreground">Walk-ins use today in the business timezone.</p>}
            </div>

            <div className="space-y-2">
              <Label>Service point {isWalkIn ? "" : "(optional)"}</Label>
              <Select
                value={form.servicePointId || (isWalkIn ? undefined : AUTO_ASSIGN_VALUE)}
                onValueChange={selectServicePoint}
                disabled={availabilityLoading || !availability || submitting}
              >
                <SelectTrigger aria-label="Service point">
                  <SelectValue placeholder={isWalkIn ? "Select a table" : "Automatic assignment"} />
                </SelectTrigger>
                <SelectContent>
                  {!isWalkIn && (
                    <SelectItem value={AUTO_ASSIGN_VALUE} disabled={!availability?.noPreferenceAvailable}>
                      Automatic assignment
                    </SelectItem>
                  )}
                  {availability?.servicePoints.map((servicePoint) => (
                    <SelectItem key={servicePoint.servicePointId} value={servicePoint.servicePointId}>
                      {servicePoint.label || "Service point"}
                      {servicePoint.capacity ? ` · seats ${servicePoint.capacity}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start time</Label>
              <Select
                value={form.startTime || undefined}
                onValueChange={selectStartTime}
                disabled={availabilityLoading || !availability || availability.availableStartTimes.length === 0 || submitting}
              >
                <SelectTrigger aria-label="Start time">
                  <SelectValue placeholder={availabilityLoading ? "Checking availability…" : "Choose a start time"} />
                </SelectTrigger>
                <SelectContent>
                  {availability?.availableStartTimes.map((time) => (
                    <SelectItem key={time} value={time}>{formatTime(time)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>End time</Label>
              <Select
                value={form.endTime || undefined}
                onValueChange={selectEndTime}
                disabled={availabilityLoading || !form.startTime || !availability || availability.validEndTimes.length === 0 || submitting}
              >
                <SelectTrigger aria-label="End time">
                  <SelectValue placeholder={form.startTime ? "Choose an end time" : "Choose a start time first"} />
                </SelectTrigger>
                <SelectContent>
                  {availability?.validEndTimes.map((time) => (
                    <SelectItem key={time} value={time}>{formatTime(time)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="restaurant-special-request">Notes or special requests</Label>
            <Textarea
              id="restaurant-special-request"
              value={form.specialRequest}
              onChange={(event) => updateTextField("specialRequest", event.target.value)}
              placeholder="Accessibility, dietary, celebration, seating notes…"
              maxLength={500}
            />
          </div>

          {availabilityError && (
            <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{availabilityError}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRefreshVersion((version) => version + 1)}>
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          )}

          {!availabilityError && statusMessage && !availabilityLoading && (
            <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {statusMessage}
            </p>
          )}

          {availabilityLoading && !availability && (
            <p role="status" className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading current availability…
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || availabilityLoading || !availability || Boolean(availabilityError)}
            >
              {submitting && <Loader2 className="animate-spin" />}
              {isWalkIn ? "Seat Walk-In" : "Create Reservation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
