"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format } from "date-fns";
import {
  Loader2,
  BedDouble,
  Users,
  Calendar,
  BadgeCheck,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Minus,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import apiClient from "@/lib/axios-config";
import { toast } from "sonner";
import {
  HotelStayDatePicker,
  type HotelStayDateRange,
} from "@/components/reservations/hotel/HotelStayDatePicker";
import {
  addReservationDateDays,
  getBusinessLocalReservationDate,
  getReservationNights,
} from "@/lib/reservation-date";
import { useBusinessSettings } from "@/contexts/BusinessContext";
import HotelPricingBreakdown, {
  type CustomerPricingBreakdown,
} from "@/components/reservations/hotel/HotelPricingBreakdown";
import { HotelRoomPriceDisplay, type RoomPricingSummary } from "@/components/reservations/hotel/HotelRoomPriceDisplay";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AvailableRoom {
  servicePointId: string;
  label: string;
  servicePointType: string;
  roomType: string | null;
  capacity: number | null;
  pricePerNight: number | null;
  currency?: string | null;
  available: boolean;
  capacityExceeded: boolean;
  pricingSummary?: RoomPricingSummary | null;
}



// ─────────────────────────────────────────────────────────────────────────────
// Step type
// ─────────────────────────────────────────────────────────────────────────────
type Step = "stay" | "room" | "guest" | "payment";
type RoomSort = "name" | "price-asc" | "price-desc" | "capacity";

const ALL_ROOMS_CATEGORY = "__all_rooms__";
const OTHER_ROOMS_CATEGORY = "__other_rooms__";
const roomLabelCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function getRoomCategory(roomType: string | null) {
  const label = roomType?.trim().replace(/\s+/g, " ");
  return {
    key: label?.toLocaleLowerCase() || OTHER_ROOMS_CATEGORY,
    label: label || "Other rooms",
  };
}

interface StaffHotelReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newReservation: any) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function StaffHotelReservationDialog({
  open,
  onOpenChange,
  onSuccess,
}: StaffHotelReservationDialogProps) {
  const { timezone, currency } = useBusinessSettings();
  const today = getBusinessLocalReservationDate(timezone);
  const defaultCheckOutDate = addReservationDateDays(today, 1);

  // ── Step ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("stay");

  // ── Stay dates ───────────────────────────────────────────────────────────
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkOutDate, setCheckOutDate] = useState(defaultCheckOutDate);
  const [guestCount, setGuestCount] = useState(2);
  const [stayError, setStayError] = useState<string | null>(null);

  // ── Room selection ───────────────────────────────────────────────────────
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [activeRoomCategory, setActiveRoomCategory] = useState(ALL_ROOMS_CATEGORY);
  const [roomSort, setRoomSort] = useState<RoomSort>("name");

  // ── Guest details ─────────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [guestErrors, setGuestErrors] = useState<{
    customerName?: string;
    phone?: string;
  }>({});

  // ── Payment ───────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "pos_card">("cash");
  const [checkInNow, setCheckInNow] = useState(false);

  // ── Submission ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const reservationAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  const nights = getReservationNights(checkInDate, checkOutDate);

  const isToday = checkInDate === today;

  const [pricingPreview, setPricingPreview] = useState<CustomerPricingBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  useEffect(() => {
    if (step === "payment" && selectedRoom && checkInDate && checkOutDate) {
      setPricingLoading(true);
      setPricingError(null);
      apiClient.get("/owner/reservations/pricing-preview", {
        params: {
          checkInDate,
          checkOutDate,
          servicePointId: selectedRoom.servicePointId,
        }
      })
      .then(({ data }) => setPricingPreview(data))
      .catch((err: any) => {
        setPricingError(err.response?.data?.error ?? "Failed to load pricing breakdown.");
      })
      .finally(() => setPricingLoading(false));
    }
  }, [step, selectedRoom, checkInDate, checkOutDate]);

  const categorySummaries = useMemo(() => {
    const summaries = new Map<
      string,
      { key: string; label: string; totalRooms: number; availableRooms: number }
    >();

    rooms.forEach((room) => {
      const category = getRoomCategory(room.roomType);
      const summary = summaries.get(category.key) ?? {
        ...category,
        totalRooms: 0,
        availableRooms: 0,
      };
      summary.totalRooms += 1;
      if (room.available) summary.availableRooms += 1;
      summaries.set(category.key, summary);
    });

    return Array.from(summaries.values());
  }, [rooms]);

  const totalAvailableRooms = useMemo(
    () => rooms.filter((room) => room.available).length,
    [rooms],
  );

  const filteredAvailableRooms = useMemo(() => {
    const filtered = rooms.filter((room) => {
      if (!room.available) return false;
      if (activeRoomCategory === ALL_ROOMS_CATEGORY) return true;
      return getRoomCategory(room.roomType).key === activeRoomCategory;
    });

    return filtered.sort((first, second) => {
      if (roomSort === "price-asc" || roomSort === "price-desc") {
        const firstPrice = first.pricePerNight;
        const secondPrice = second.pricePerNight;
        if (firstPrice == null) return secondPrice == null ? 0 : 1;
        if (secondPrice == null) return -1;
        return roomSort === "price-asc"
          ? firstPrice - secondPrice
          : secondPrice - firstPrice;
      }

      if (roomSort === "capacity") {
        const firstCapacity = first.capacity;
        const secondCapacity = second.capacity;
        if (firstCapacity == null) return secondCapacity == null ? 0 : 1;
        if (secondCapacity == null) return -1;
        return secondCapacity - firstCapacity;
      }

      return roomLabelCollator.compare(first.label, second.label);
    });
  }, [activeRoomCategory, roomSort, rooms]);

  const activeCategoryLabel =
    activeRoomCategory === ALL_ROOMS_CATEGORY
      ? null
      : categorySummaries.find((category) => category.key === activeRoomCategory)?.label ?? null;
  const selectableRoomCount = filteredAvailableRooms.filter(
    (room) => !room.capacityExceeded,
  ).length;

  // ── Reset when dialog closes ──────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setStep("stay");
    setCheckInDate(today);
    setCheckOutDate(defaultCheckOutDate);
    setGuestCount(2);
    setStayError(null);
    setRooms([]);
    setRoomsLoading(false);
    setRoomsError(null);
    setSelectedRoom(null);
    setActiveRoomCategory(ALL_ROOMS_CATEGORY);
    setRoomSort("name");
    setCustomerName("");
    setEmail("");
    setPhone("");
    setSpecialRequest("");
    setGuestErrors({});
    setPaymentMethod("cash");
    setCheckInNow(false);
    setSubmitting(false);
    setPricingPreview(null);
    reservationAttemptRef.current = null;
  }, [defaultCheckOutDate, today]);

  useEffect(() => {
    if (!open) resetAll();
  }, [open, resetAll]);

  // ── Fetch available rooms ─────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) return;
    setRoomsLoading(true);
    setRoomsError(null);
    setSelectedRoom(null);
    setActiveRoomCategory(ALL_ROOMS_CATEGORY);
    try {
      const { data } = await apiClient.get("/owner/reservations/availability", {
        params: { checkInDate, checkOutDate, guestCount },
      });
      setRooms(data.rooms ?? []);
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Failed to load available rooms.";
      setRoomsError(message);
      toast.error(message);
    } finally {
      setRoomsLoading(false);
    }
  }, [checkInDate, checkOutDate, guestCount]);

  const handleStayDateChange = (range: HotelStayDateRange) => {
    setCheckInDate(range.checkInDate);
    setCheckOutDate(range.checkOutDate);
    setStayError(null);
    setSelectedRoom(null);
    setRooms([]);
    setRoomsError(null);
    setActiveRoomCategory(ALL_ROOMS_CATEGORY);
  };

  const updateGuestCount = (nextCount: number) => {
    const clampedCount = Math.min(50, Math.max(1, nextCount));
    if (clampedCount === guestCount) return;
    setGuestCount(clampedCount);
    setSelectedRoom(null);
    setRooms([]);
    setRoomsError(null);
  };

  // ── Step navigation ───────────────────────────────────────────────────────
  const goToRooms = async () => {
    if (!checkInDate || !checkOutDate) {
      const message = "Please select check-in and check-out dates.";
      setStayError(message);
      toast.error(message);
      return;
    }
    if (checkOutDate <= checkInDate) {
      const message = "Check-out must be after check-in.";
      setStayError(message);
      toast.error(message);
      return;
    }
    if (guestCount < 1) {
      toast.error("Guest count must be at least 1.");
      return;
    }
    setStayError(null);
    setStep("room");
    await fetchRooms();
  };

  const goToGuest = () => {
    if (!selectedRoom) {
      toast.error("Please select a room.");
      return;
    }
    if (!selectedRoom.available) {
      toast.error("The selected room is no longer available.");
      return;
    }
    if (selectedRoom.capacityExceeded) {
      toast.error("The selected room cannot accommodate this guest count.");
      return;
    }
    setStep("guest");
  };

  const goToPayment = () => {
    const nextErrors: { customerName?: string; phone?: string } = {};

    if (!customerName.trim()) {
      nextErrors.customerName = "Guest name is required.";
    }
    if (!phone.trim()) {
      nextErrors.phone = "Phone number is required.";
    }

    setGuestErrors(nextErrors);
    const firstError = nextErrors.customerName || nextErrors.phone;
    if (firstError) {
      toast.error(firstError);
      return;
    }

    setStep("payment");
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (doCheckIn: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        checkInDate,
        checkOutDate,
        guestCount,
        servicePointId: selectedRoom!.servicePointId,
        specialRequest: specialRequest.trim() || undefined,
        paymentMethod,
        checkInNow: doCheckIn,
      };

      const fingerprint = JSON.stringify(payload);
      if (reservationAttemptRef.current?.fingerprint !== fingerprint) {
        reservationAttemptRef.current = {
          fingerprint,
          key: `hotel:${crypto.randomUUID()}`,
        };
      }

      const { data } = await apiClient.post("/owner/reservations", payload, {
        headers: { "Idempotency-Key": reservationAttemptRef.current.key },
      });

      toast.success(
        doCheckIn
          ? `${customerName} has been booked & checked in!`
          : `Booking confirmed for ${customerName}.`,
      );
      onSuccess(data.reservation);
      onOpenChange(false);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? "Failed to create booking.";
      if (err.response?.status === 409) {
        // Room was just taken — go back to room selection
        toast.error(`${msg} Please choose another room.`);
        setSelectedRoom(null);
        setStep("room");
        fetchRooms();
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────
  function renderStepIndicator() {
    const steps: { id: Step; label: string }[] = [
      { id: "stay", label: "Stay" },
      { id: "room", label: "Room" },
      { id: "guest", label: "Guest" },
      { id: "payment", label: "Payment" },
    ];
    const currentIndex = steps.findIndex((s) => s.id === step);
    return (
      <div className="flex items-center gap-0 mb-6">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  i < currentIndex
                    ? "bg-primary border-primary text-primary-foreground"
                    : i === currentIndex
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground"
                }`}
              >
                {i < currentIndex ? "✓" : i + 1}
              </div>
              <span
                className={`text-[10px] font-semibold mt-1 ${
                  i === currentIndex ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 mb-4 transition-all ${
                  i < currentIndex ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Step: Stay dates ──────────────────────────────────────────────────────
  function renderStayStep() {
    return (
      <div className="space-y-5">
        <HotelStayDatePicker
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          minDate={today}
          onChange={handleStayDateChange}
          onError={setStayError}
          instruction={null}
          summaryAccessory={(
            <div className="flex h-full flex-col items-center justify-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Guests
              </p>
              <div className="mt-1 flex items-center justify-center gap-2" role="group" aria-label="Number of guests">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 rounded-xl"
                  onClick={() => updateGuestCount(guestCount - 1)}
                  disabled={guestCount <= 1}
                  aria-label="Remove one guest"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-xl font-black text-foreground" aria-live="polite">
                  {guestCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 rounded-xl"
                  onClick={() => updateGuestCount(guestCount + 1)}
                  disabled={guestCount >= 50}
                  aria-label="Add one guest"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        />

        {stayError && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            {stayError}
          </p>
        )}

        <Button className="w-full" onClick={goToRooms} disabled={!checkInDate || !checkOutDate || nights < 1}>
          Search Available Rooms →
        </Button>
      </div>
    );
  }

  // ── Step: Room selection ──────────────────────────────────────────────────
  function renderRoomStep() {
    const overviewItems = [
      {
        key: ALL_ROOMS_CATEGORY,
        label: "All rooms",
        totalRooms: rooms.length,
        availableRooms: totalAvailableRooms,
      },
      ...categorySummaries,
    ];
    const resultsTitle = activeCategoryLabel
      ? `${activeCategoryLabel} rooms`
      : "Rooms";

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6 sm:px-6">
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 text-muted-foreground">
              {format(new Date(checkInDate + "T00:00"), "MMM d")} →{" "}
              {format(new Date(checkOutDate + "T00:00"), "MMM d, yyyy")}
              <span className="mx-2">•</span>
              <span className="font-bold text-foreground">
                {nights} {nights === 1 ? "night" : "nights"}
              </span>
              <span className="mx-2">•</span>
              <span className="font-bold text-foreground">
                {guestCount} {guestCount === 1 ? "guest" : "guests"}
              </span>
            </span>
            <button
              type="button"
              className="ml-auto shrink-0 text-xs font-bold text-primary hover:underline"
              onClick={() => {
                setStep("stay");
                setSelectedRoom(null);
              }}
            >
              Change
            </button>
          </div>

          {roomsLoading ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm font-medium">Checking room availability...</p>
            </div>
          ) : roomsError ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center text-destructive">
              <AlertCircle className="h-7 w-7" />
              <div>
                <p className="text-sm font-semibold">Room availability could not be loaded.</p>
                <p className="mt-1 text-xs text-muted-foreground">{roomsError}</p>
              </div>
              <Button size="sm" variant="outline" onClick={fetchRooms}>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : (
            <>
              <section aria-labelledby="availability-overview-heading" className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 id="availability-overview-heading" className="font-bold text-foreground">
                      Availability Overview
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Availability for the complete selected stay
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Total rooms: <strong className="text-foreground">{rooms.length}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Available: <strong className="text-emerald-600">{totalAvailableRooms}</strong>
                    </span>
                  </div>
                </div>

                <div
                  role="tablist"
                  aria-label="Filter available rooms by category"
                  className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-[repeat(auto-fit,minmax(145px,1fr))] md:overflow-visible md:pb-0"
                >
                  {overviewItems.map((item) => {
                    const isActive = activeRoomCategory === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveRoomCategory(item.key)}
                        className={`min-w-36 rounded-xl border-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:min-w-0 ${
                          isActive
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                        }`}
                      >
                        <span className={`block truncate text-xs font-bold ${isActive ? "text-primary" : "text-foreground"}`}>
                          {item.label}
                        </span>
                        <span className="mt-1 block text-2xl font-black leading-none text-foreground">
                          {item.totalRooms}
                        </span>
                        <span className={`mt-1.5 block text-xs font-medium ${item.availableRooms === 0 ? "text-destructive" : "text-emerald-600"}`}>
                          {item.availableRooms} available
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="room-results-heading" className="space-y-3 border-t border-border/60 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 id="room-results-heading" className="font-bold text-foreground">
                      {resultsTitle} <span className="text-emerald-600">({filteredAvailableRooms.length} available)</span>
                    </h3>
                    {filteredAvailableRooms.length > 0 && selectableRoomCount < filteredAvailableRooms.length && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {selectableRoomCount} can accommodate {guestCount} {guestCount === 1 ? "guest" : "guests"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={roomSort} onValueChange={(value) => setRoomSort(value as RoomSort)}>
                      <SelectTrigger className="w-full sm:w-56" aria-label="Sort available rooms">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Room name / number</SelectItem>
                        <SelectItem value="price-asc">Price: Low to high</SelectItem>
                        <SelectItem value="price-desc">Price: High to low</SelectItem>
                        <SelectItem value="capacity">Capacity</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={fetchRooms}
                      aria-label="Refresh room availability"
                      title="Refresh availability"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {rooms.length === 0 ? (
                  <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center text-muted-foreground">
                    <BedDouble className="h-9 w-9 opacity-50" />
                    <p className="text-sm font-semibold text-foreground">No rooms configured</p>
                    <p className="text-xs">Add lodging service points in Settings.</p>
                  </div>
                ) : filteredAvailableRooms.length === 0 ? (
                  <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-4 text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 opacity-60" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        No {activeCategoryLabel ? `${activeCategoryLabel.toLocaleLowerCase()} rooms` : "rooms"} are available for the selected stay.
                      </p>
                      <p className="mt-1 text-xs">Try another room category or change the stay dates.</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setStep("stay")}>
                      Change dates
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1180px]:grid-cols-4">
                    {filteredAvailableRooms.map((room) => {
                      const isSelected = selectedRoom?.servicePointId === room.servicePointId;
                      const capacityWarning = room.capacityExceeded;
                      const category = getRoomCategory(room.roomType);

                      return (
                        <button
                          key={room.servicePointId}
                          type="button"
                          disabled={capacityWarning}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedRoom(room)}
                          className={`group flex min-h-52 flex-col rounded-xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-md"
                              : capacityWarning
                              ? "cursor-not-allowed border-amber-200 bg-amber-50/50 opacity-75 dark:bg-amber-950/10"
                              : "border-border bg-card shadow-sm hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-black text-foreground">{room.label}</p>
                              <span className="mt-1.5 inline-flex max-w-full rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                <span className="truncate">{category.label}</span>
                              </span>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                            )}
                          </div>

                          <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {room.capacity != null ? `Up to ${room.capacity} guests` : "Capacity not listed"}
                          </div>

                          <div className="mt-auto pt-5">
                            {room.pricePerNight != null ? (
                              <HotelRoomPriceDisplay
                                pricePerNight={room.pricePerNight}
                                currency={room.currency || currency}
                                pricingSummary={room.pricingSummary}
                                size="sm"
                              />
                            ) : (
                              <p className="text-xs font-medium text-muted-foreground">Price not listed</p>
                            )}

                            <span className={`mt-3 flex h-9 w-full items-center justify-center rounded-md border text-sm font-bold transition-colors ${
                              capacityWarning
                                ? "border-amber-300 bg-amber-100/60 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                : isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-primary text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                            }`}>
                              {capacityWarning
                                ? `Not suitable for ${guestCount} ${guestCount === 1 ? "guest" : "guests"}`
                                : isSelected
                                ? "Selected"
                                : "Select room"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button variant="outline" onClick={() => setStep("stay")}>
            ← Back
          </Button>
          <Button
            onClick={goToGuest}
            disabled={
              !selectedRoom ||
              !selectedRoom.available ||
              selectedRoom.capacityExceeded
            }
          >
            Continue to Guest Details →
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: Guest details ───────────────────────────────────────────────────
  function renderGuestStep() {
    const bookingCurrency = selectedRoom?.currency || currency;

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
          <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:gap-6">
            <section
              aria-labelledby="guest-details-heading"
              className="rounded-xl border border-border bg-background p-4 sm:p-6"
            >
              <div className="mb-5">
                <h3 id="guest-details-heading" className="text-base font-bold text-foreground">
                  Guest details
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Who is staying in this room?
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="nbd-name">
                    Guest Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nbd-name"
                    placeholder="Full name"
                    value={customerName}
                    onChange={(event) => {
                      setCustomerName(event.target.value);
                      if (guestErrors.customerName) {
                        setGuestErrors((current) => ({ ...current, customerName: undefined }));
                      }
                    }}
                    onBlur={() => {
                      if (!customerName.trim()) {
                        setGuestErrors((current) => ({
                          ...current,
                          customerName: "Guest name is required.",
                        }));
                      }
                    }}
                    aria-invalid={Boolean(guestErrors.customerName)}
                    aria-describedby={guestErrors.customerName ? "nbd-name-error" : undefined}
                    required
                  />
                  {guestErrors.customerName && (
                    <p id="nbd-name-error" className="text-sm font-medium text-destructive">
                      {guestErrors.customerName}
                    </p>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nbd-phone">
                      Phone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="nbd-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+00 000 000 000"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        if (guestErrors.phone) {
                          setGuestErrors((current) => ({ ...current, phone: undefined }));
                        }
                      }}
                      onBlur={() => {
                        if (!phone.trim()) {
                          setGuestErrors((current) => ({
                            ...current,
                            phone: "Phone number is required.",
                          }));
                        }
                      }}
                      aria-invalid={Boolean(guestErrors.phone)}
                      aria-describedby={guestErrors.phone ? "nbd-phone-error" : undefined}
                      required
                    />
                    {guestErrors.phone && (
                      <p id="nbd-phone-error" className="text-sm font-medium text-destructive">
                        {guestErrors.phone}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nbd-email">Email (optional)</Label>
                    <Input
                      id="nbd-email"
                      type="email"
                      autoComplete="email"
                      placeholder="guest@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nbd-notes">Special Requests / Notes</Label>
                  <Textarea
                    id="nbd-notes"
                    className="min-h-28 resize-none"
                    placeholder="Late arrival, accessibility needs, room preferences, special requests..."
                    maxLength={500}
                    value={specialRequest}
                    onChange={(event) => setSpecialRequest(event.target.value)}
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {specialRequest.length}/500
                  </p>
                </div>
              </div>
            </section>

            {selectedRoom && (
              <aside
                aria-labelledby="booking-summary-heading"
                className="self-start rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 lg:sticky lg:top-0"
              >
                <h3
                  id="booking-summary-heading"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Booking summary
                </h3>

                <div className="mt-4 border-b border-border/70 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BedDouble className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Room
                      </p>
                      <p className="truncate text-base font-bold text-foreground">
                        {selectedRoom.label}
                      </p>
                      <p className="text-sm capitalize text-muted-foreground">
                        {selectedRoom.roomType || "Room"}
                      </p>
                    </div>
                  </div>
                </div>

                <dl className="divide-y divide-border/70 text-sm">
                  <div className="py-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Stay
                    </dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {checkInDate && format(new Date(checkInDate + "T00:00"), "MMM d")} →{" "}
                      {checkOutDate && format(new Date(checkOutDate + "T00:00"), "MMM d, yyyy")}
                    </dd>
                    <dd className="mt-0.5 text-muted-foreground">
                      {nights} {nights === 1 ? "night" : "nights"}
                    </dd>
                  </div>

                  <div className="py-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Guests
                    </dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {guestCount} {guestCount === 1 ? "guest" : "guests"}
                    </dd>
                  </div>

                  <div className="py-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pricing
                    </dt>
                    <dd className="mt-2">
                      <HotelRoomPriceDisplay
                        pricePerNight={selectedRoom.pricePerNight ?? 0}
                        currency={bookingCurrency}
                        pricingSummary={selectedRoom.pricingSummary}
                        size="md"
                      />
                    </dd>
                  </div>
                </dl>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-1 w-full border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => setStep("room")}
                >
                  Change Room
                </Button>
              </aside>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-3 border-t border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button variant="outline" onClick={() => setStep("room")}>
            ← Back
          </Button>
          <Button
            onClick={goToPayment}
            disabled={!customerName.trim() || !phone.trim()}
          >
            Continue to Payment →
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: Payment ─────────────────────────────────────────────────────────
  function renderPaymentStep() {
    return (
      <div className="space-y-5">
        {/* Pricing breakdown */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Pricing Summary
          </p>
          {pricingLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Calculating exact pricing...</p>
            </div>
          ) : pricingError ? (
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm font-semibold text-center">{pricingError}</p>
            </div>
          ) : pricingPreview ? (
            <HotelPricingBreakdown
              pricing={pricingPreview}
              pricePerNight={selectedRoom?.pricePerNight ?? undefined}
              numberOfNights={nights}
              currency={selectedRoom?.currency || currency}
              totalLabel="Amount Due"
            />
          ) : null}
        </div>

        {/* Payment method */}
        <div className="space-y-3">
          <p className="text-sm font-bold text-foreground">How did the customer pay?</p>
          <div className="grid grid-cols-2 gap-3">
            {(["cash", "pos_card"] as const).map((method) => {
              const label = method === "cash" ? "💵 Cash" : "💳 POS / Terminal";
              return (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-xl border-2 py-3.5 px-4 text-sm font-bold transition-all ${
                    paymentMethod === method
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-foreground hover:border-primary/40"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            By confirming, you attest that payment has been received from the guest.
          </p>
        </div>

        {/* Guest + room summary */}
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Guest</span>
            <span className="font-semibold text-foreground">{customerName}</span>
          </div>
          {selectedRoom && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Room</span>
              <span className="font-semibold text-foreground">{selectedRoom.label}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stay</span>
            <span className="font-semibold text-foreground">
              {checkInDate && format(new Date(checkInDate + "T00:00"), "MMM d")} →{" "}
              {checkOutDate && format(new Date(checkOutDate + "T00:00"), "MMM d, yyyy")}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2.5 pt-1">
          <Button variant="outline" onClick={() => setStep("guest")} disabled={submitting}>
            ← Back
          </Button>
          {/* Future stay OR same-day without immediate check-in */}
          <Button
            className="w-full"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
          >
            {submitting && !checkInNow ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Booking…
              </>
            ) : (
              <>
                <BadgeCheck className="mr-2 h-4 w-4" />
                Confirm Payment &amp; Complete Booking
              </>
            )}
          </Button>

          {/* Same-day: offer immediate check-in */}
          {isToday && (
            <Button
              variant="secondary"
              className="w-full font-bold"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
            >
              {submitting && checkInNow ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Booking &amp; Checking In…
                </>
              ) : (
                <>
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Confirm Payment, Book &amp; Check In Now
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  const stepTitles: Record<Step, string> = {
    stay: "New Booking — Stay Details",
    room: "New Booking — Select Room",
    guest: "New Booking — Guest Details",
    payment: "New Booking — Confirm Payment",
  };

  const stepDescriptions: Record<Step, string> = {
    stay: "Enter stay dates and number of guests to search for available rooms.",
    room: "Select a room for this booking.",
    guest: "Enter the guest's contact details.",
    payment: "Record payment received from the guest to complete the booking.",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent
        className={`flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-3rem)] sm:max-w-[1280px] ${
          step === "stay" || step === "room"
            ? "h-[96dvh] max-h-[96dvh]"
            : "max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)]"
        }`}
      >
        <DialogHeader className="shrink-0 px-4 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6 sm:pr-14">
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-primary" />
            {stepTitles[step]}
          </DialogTitle>
          <DialogDescription>{stepDescriptions[step]}</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 px-4 sm:px-6">{renderStepIndicator()}</div>

        {step === "room" ? (
          renderRoomStep()
        ) : step === "guest" ? (
          renderGuestStep()
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
            <div className={`mx-auto w-full ${step === "stay" ? "max-w-3xl" : "max-w-2xl"}`}>
              {step === "stay" && renderStayStep()}
              {step === "payment" && renderPaymentStep()}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
