"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  formatOptionalReservationDate,
  getReservationNights,
} from "@/lib/reservation-date"
import { cn } from "@/lib/utils"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const
const DAY_ABBREVIATIONS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const

export interface HotelStayDateRange {
  checkInDate: string
  checkOutDate: string
}

interface HotelStayDatePickerProps extends HotelStayDateRange {
  minDate: string
  onChange: (range: HotelStayDateRange) => void
  onError?: (message: string | null) => void
  instruction?: string | null
  summaryAccessory?: ReactNode
  className?: string
}

function getVisibleMonth(value: string) {
  return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : "1970-01"
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`
}

export function HotelStayDatePicker({
  checkInDate,
  checkOutDate,
  minDate,
  onChange,
  onError,
  instruction,
  summaryAccessory,
  className,
}: HotelStayDatePickerProps) {
  const [selectionPhase, setSelectionPhase] = useState<"checkIn" | "checkOut">("checkIn")
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getVisibleMonth(checkInDate || minDate),
  )
  const nights = getReservationNights(checkInDate, checkOutDate)
  const instructionCopy = instruction === undefined
    ? selectionPhase === "checkIn"
      ? "Select your check-in date."
      : "Now select your check-out date."
    : instruction
  const summaryItemClassName = summaryAccessory
    ? "min-w-0 bg-card px-3 py-3 text-center"
    : "flex items-center justify-between gap-4 bg-card px-4 py-2 sm:block sm:min-w-0 sm:px-3 sm:py-4 sm:text-center"

  useEffect(() => {
    const anchorDate = checkInDate || minDate
    if (anchorDate) setVisibleMonth(getVisibleMonth(anchorDate))
    if (!checkInDate) setSelectionPhase("checkIn")
  }, [checkInDate, minDate])

  const calendar = useMemo(() => {
    const [year, month] = visibleMonth.split("-").map(Number)
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const cells: Array<number | null> = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ]
    while (cells.length % 7 !== 0) cells.push(null)

    return { year, month, cells }
  }, [visibleMonth])

  const selectDate = (date: string) => {
    onError?.(null)

    if (selectionPhase === "checkIn") {
      onChange({ checkInDate: date, checkOutDate: "" })
      setSelectionPhase("checkOut")
      return
    }

    if (date <= checkInDate) {
      onError?.("Check-out must be after check-in.")
      return
    }

    onChange({ checkInDate, checkOutDate: date })
    setSelectionPhase("checkIn")
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {instructionCopy && (
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {instructionCopy}
        </p>
      )}

      {(checkInDate || checkOutDate) && (
        <div
          className={cn(
            "grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm",
            summaryAccessory ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3",
          )}
        >
          <div className={summaryItemClassName}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:mb-1">
              Check-in
            </p>
            <p className={cn("text-sm font-bold", checkInDate ? "text-foreground" : "text-muted-foreground")}>
              {checkInDate ? formatOptionalReservationDate(checkInDate) : "—"}
            </p>
          </div>
          <div className={summaryItemClassName}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:mb-1">
              Check-out
            </p>
            <p className={cn("text-sm font-bold", checkOutDate ? "text-foreground" : "text-muted-foreground")}>
              {checkOutDate ? formatOptionalReservationDate(checkOutDate) : "—"}
            </p>
          </div>
          <div className={summaryItemClassName}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:mb-1">
              Nights
            </p>
            <p className="text-sm font-black text-primary">{nights}</p>
          </div>
          {summaryAccessory && (
            <div className="min-w-0 bg-card px-3 py-3">
              {summaryAccessory}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-3 py-3 sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Show previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-foreground" aria-live="polite">
            {MONTH_NAMES[calendar.month - 1]} {calendar.year}
          </span>
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Show next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-muted/20">
          {DAY_ABBREVIATIONS.map((day) => (
            <div key={day} className="py-2.5 text-center text-[10px] font-bold uppercase text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 p-2">
          {calendar.cells.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} aria-hidden="true" />

            const date = `${calendar.year}-${String(calendar.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            const isPast = date < minDate
            const isCheckIn = date === checkInDate
            const isCheckOut = date === checkOutDate
            const isInRange = Boolean(
              checkInDate && checkOutDate && date > checkInDate && date < checkOutDate,
            )

            return (
              <button
                key={date}
                type="button"
                disabled={isPast}
                onClick={() => selectDate(date)}
                aria-label={formatOptionalReservationDate(date)}
                aria-pressed={isCheckIn || isCheckOut}
                className={cn(
                  "h-9 w-full select-none rounded-xl text-sm font-semibold transition-all sm:h-10",
                  isPast && "cursor-not-allowed text-muted-foreground/30",
                  (isCheckIn || isCheckOut) && "bg-primary text-primary-foreground shadow-md",
                  isInRange && "bg-primary/15 text-primary",
                  !isPast && !isCheckIn && !isCheckOut && !isInRange && "text-foreground hover:bg-muted",
                )}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
