"use client";

import { useMemo, useState } from "react";
import { formatReservationDate as formatDate } from "@/lib/reservation-date";
import type { ReservationDashboardRecord, ReservationDashboardServicePoint } from "@/components/reservations/dashboard/useReservationDashboard";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HotelCalendarTapeChartProps {
  reservations: ReservationDashboardRecord[];
  servicePoints: ReservationDashboardServicePoint[];
  clientToday: string;
  /** ISO date string: the first visible column date (YYYY-MM-DD) */
  startDateStr: string;
  /** Number of visible columns */
  daysToShow: 7 | 14;
  onStartDateChange: (newStart: string) => void;
  onDaysToShowChange: (days: 7 | 14) => void;
  onReservationClick: (reservation: ReservationDashboardRecord) => void;
}

/**
 * Build an array of YYYY-MM-DD strings for the visible window.
 * All date arithmetic uses UTC to avoid local-timezone shifts on date-only strings.
 */
function buildDateRange(startStr: string, count: number): string[] {
  const arr: string[] = [];
  // Parse as UTC noon to guard against DST edge cases
  const base = new Date(`${startStr}T12:00:00Z`);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    arr.push(d.toISOString().split("T")[0]);
  }
  return arr;
}

/**
 * Compute the exclusive end date string for the visible window.
 */
function buildEndExclusive(startStr: string, daysToShow: number): string {
  const base = new Date(`${startStr}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + daysToShow);
  return base.toISOString().split("T")[0];
}

/**
 * Shift a YYYY-MM-DD string by N days (UTC-safe).
 */
function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export function HotelCalendarTapeChart({
  reservations,
  servicePoints,
  clientToday,
  startDateStr,
  daysToShow,
  onStartDateChange,
  onDaysToShowChange,
  onReservationClick,
}: HotelCalendarTapeChartProps) {
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<string>("all");

  const dates = useMemo(() => buildDateRange(startDateStr, daysToShow), [startDateStr, daysToShow]);

  // The exclusive end date for the current visible window
  const endExclusiveStr = useMemo(() => buildEndExclusive(startDateStr, daysToShow), [startDateStr, daysToShow]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    servicePoints.forEach((sp) => {
      if (sp.roomType) cats.add(sp.roomType);
    });
    return Array.from(cats).sort();
  }, [servicePoints]);

  // Room category filter state — local, doesn't re-fetch
  const visibleRooms = useMemo(() => {
    let filtered = servicePoints;
    if (roomCategoryFilter !== "all") {
      filtered = servicePoints.filter((sp) => sp.roomType === roomCategoryFilter);
    }
    return filtered
      .slice()
      .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }, [servicePoints, roomCategoryFilter]);

  /**
   * Canonical block geometry function.
   *
   * Interval model:
   *   Reservation: [checkInDate, checkOutDate)   — checkout date is exclusive
   *   Visible window: [dates[0], endExclusiveStr) — endExclusiveStr is exclusive
   *
   * Overlap condition:
   *   checkInDate  < endExclusiveStr   (reservation starts before window closes)
   *   checkOutDate > dates[0]          (reservation ends after window opens)
   *
   * Column mapping:
   *   Each column i represents the stay night that starts on dates[i].
   *   A guest staying Oct 1→Oct 3 occupies columns for Oct 1 and Oct 2
   *   (the night of Oct 1 and the night of Oct 2).
   */
  const getReservationBlock = (
    reservation: ReservationDashboardRecord,
    roomIndex: number
  ): { left: string; width: string; top: string; className: string; reservation: ReservationDashboardRecord } | null => {
    const checkIn = reservation.checkInDate || "";
    const checkOut = reservation.checkOutDate || "";
    const visibleStart = dates[0];
    const visibleEnd = endExclusiveStr;

    // 1. Overlap guard — reservation must intersect [visibleStart, visibleEnd)
    if (checkOut <= visibleStart || checkIn >= visibleEnd) return null;

    // 2. Clamp to visible window
    const clampedStart = checkIn < visibleStart ? visibleStart : checkIn;
    const clampedEnd = checkOut > visibleEnd ? visibleEnd : checkOut;

    // 3. Convert clamped date strings to column indices
    //    Column i = dates[i], so we find the index by string comparison against dates[]
    const startIndex = dates.indexOf(clampedStart);
    // If clampedStart is exactly in dates[], indexOf works.
    // If clampedStart fell between dates (shouldn't happen since buildDateRange is dense),
    // fall back to a search.
    const leftCol = startIndex !== -1
      ? startIndex
      : dates.findIndex((d) => d >= clampedStart);

    // For the end column: clampedEnd is exclusive. Find the index of the last occupied column.
    // The last occupied night is clampedEnd - 1 day. We find how many columns are covered.
    const endIndex = dates.indexOf(clampedEnd);
    const rightCol = endIndex !== -1
      ? endIndex
      : dates.findIndex((d) => d >= clampedEnd) !== -1
        ? dates.findIndex((d) => d >= clampedEnd)
        : dates.length; // clampedEnd is beyond the visible window

    const span = rightCol - leftCol;
    if (span <= 0) return null;

    // 4. Color by status
    const isPending = reservation.status === "pending" || reservation.status === "accepted_awaiting_payment";
    const isCheckedIn = reservation.status === "checked_in";
    let bgClass = "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-800 dark:text-green-300";
    if (isPending) bgClass = "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-300";
    if (isCheckedIn) bgClass = "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300";

    return {
      left: `${(leftCol / dates.length) * 100}%`,
      width: `${(span / dates.length) * 100}%`,
      top: `${roomIndex * 48}px`,
      className: bgClass,
      reservation,
    };
  };

  const reservationBlocks = useMemo(() => {
    const blocks: ReturnType<typeof getReservationBlock>[] = [];
    visibleRooms.forEach((room, roomIndex) => {
      const roomReservations = reservations.filter(
        (r) =>
          // Canonical key: servicePointId
          String(r.servicePointId) === String(room.servicePointId) &&
          // Include all hotel inventory-blocking statuses; exclude terminal failures
          !["cancelled", "declined", "expired", "no_show"].includes(r.status)
      );
      roomReservations.forEach((res) => {
        const block = getReservationBlock(res, roomIndex);
        if (block) blocks.push(block);
      });
    });
    return blocks;
  }, [reservations, visibleRooms, dates, endExclusiveStr]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Tape Chart Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onStartDateChange(shiftDateStr(startDateStr, -daysToShow))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onStartDateChange(clientToday)}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => onStartDateChange(shiftDateStr(startDateStr, daysToShow))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 ml-4 text-sm font-medium">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            {formatDate(startDateStr)} – {formatDate(shiftDateStr(startDateStr, daysToShow - 1))}
          </div>
        </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
              <button
                onClick={() => onDaysToShowChange(7)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md ${daysToShow === 7 ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                7 Days
              </button>
              <button
                onClick={() => onDaysToShowChange(14)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md ${daysToShow === 14 ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                14 Days
              </button>
            </div>

            {categories.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={roomCategoryFilter}
                  onChange={(e) => setRoomCategoryFilter(e.target.value)}
                  className="text-sm bg-transparent border border-border rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="all">All Rooms</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
      </div>

      {/* Tape Chart Grid */}
      <div className="border border-border rounded-2xl bg-card shadow-sm overflow-x-auto relative min-h-[300px]">
        <div style={{ minWidth: `${daysToShow * 100 + 150}px` }} className="relative">
          
          {/* Header Row */}
          <div className="sticky top-0 z-10 flex border-b border-border bg-muted/50 h-12">
            <div className="w-[150px] shrink-0 border-r border-border sticky left-0 z-20 bg-muted/50 flex items-center px-4 font-bold text-xs uppercase text-muted-foreground tracking-wider">
              Room
            </div>
            <div className="flex-1 flex">
              {dates.map((date) => {
                const isClientToday = date === clientToday;
                // Use UTC parsing to avoid timezone shifts on date-only strings
                const [y, m, d] = date.split("-").map(Number);
                const utcDate = new Date(Date.UTC(y, m - 1, d));
                return (
                  <div key={date} className={`flex-1 border-r border-border/50 flex flex-col justify-center items-center text-xs ${isClientToday ? "bg-primary/5 text-primary font-black" : "text-muted-foreground font-medium"}`}>
                    <span>{utcDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
                    <span>{utcDate.getUTCDate()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room Rows & Reservation Blocks */}
          <div className="relative">
            {/* Background grid rows */}
            {visibleRooms.map((room) => (
              <div key={room.servicePointId} className="flex h-12 border-b border-border/30 hover:bg-muted/10 transition-colors">
                <div className="w-[150px] shrink-0 border-r border-border sticky left-0 z-10 bg-card flex flex-col justify-center px-4">
                  <span className="font-bold text-sm text-foreground truncate">{room.label}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{room.roomType || "Standard"}</span>
                </div>
                <div className="flex-1 flex">
                  {dates.map((date) => (
                    <div key={date} className="flex-1 border-r border-border/10" />
                  ))}
                </div>
              </div>
            ))}

            {/* Reservation Blocks — absolutely positioned over the grid rows */}
            <div className="absolute top-0 left-[150px] right-0 bottom-0 pointer-events-none">
              {reservationBlocks.map((block, idx) => (
                block && (
                  <div
                    key={idx}
                    style={{ left: block.left, width: block.width, top: block.top }}
                    className={`absolute h-10 mt-1 rounded-md border text-xs px-2 py-1 overflow-hidden whitespace-nowrap cursor-pointer pointer-events-auto shadow-sm transition-transform hover:scale-[1.01] ${block.className}`}
                    onClick={() => onReservationClick(block.reservation)}
                    title={`${block.reservation.customerName} · ${block.reservation.checkInDate} → ${block.reservation.checkOutDate}`}
                  >
                    <span className="font-bold">{block.reservation.customerName}</span>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Empty state */}
          {visibleRooms.length === 0 && (
            <div className="py-16 flex flex-col items-center text-center text-muted-foreground">
              <CalendarIcon className="w-8 h-8 mb-3 opacity-30" />
              <p className="font-medium">No rooms configured</p>
              <p className="text-sm mt-1">Add service points to see the tape chart.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
