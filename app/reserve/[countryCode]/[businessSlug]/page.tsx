"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  CalendarDays,
  Clock,
  Users,
  User,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Minus,
  Plus,
  LayoutGrid,
  MessageSquare,
  MapPin,
  Utensils,
  Sparkles,
  PartyPopper,
} from "lucide-react";
import { GuestDetailsForm, GuestDetailsData } from "@/components/reservations/GuestDetailsForm";
import { HotelReservationFlow } from "@/components/reservations/hotel/HotelReservationFlow";
import { ReservationPageSkeleton } from "@/components/customer-loading-skeletons";
import apiClient from "@/lib/axios-config";
import { getBusinessLocalReservationDate } from "@/lib/reservation-date";
import {
  getMaximumConfiguredServicePointCapacity,
} from "@/lib/reservation-capacity";
import { parseRestaurantReservationPrefill } from "@/lib/restaurant-reservation-prefill";

const STEPS = ["When?", "Details", "Contact", "Confirm"] as const;

interface RestaurantAvailability {
  availableDates: string[];
  availableStartTimes: string[];
  validEndTimes: string[];
  servicePoints: Array<{
    servicePointId: string;
    label: string;
    servicePointType: string;
    capacity: number | null;
  }>;
  noPreferenceAvailable: boolean;
}

function timeToMinutes(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

function minutesToTime(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function addMinutes(timeStr: string, minsToAdd: number) {
  if (!timeStr) return "";
  let total = timeToMinutes(timeStr) + minsToAdd;
  if (Number.isNaN(total)) return "";
  // Clamp within the same day — never wrap past midnight.
  total = Math.max(0, Math.min(total, 24 * 60 - 1));
  return minutesToTime(total);
}

function calculateDuration(start: string, end: string) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatDateDisplay(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function ReservationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const countryCode = params.countryCode as string;
  const businessSlug = params.businessSlug as string;

  const [business, setBusiness] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(0);

  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    email: "",
    date: "",
    startTime: "",
    endTime: "",
    durationMinutes: 120,
    guestCount: 2,
    servicePointId: "",
    specialRequest: "",
  });
  const reservationAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const prefillAppliedRef = useRef(false);
  const pendingPrefilledStartTimeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!businessSlug) return;
    const fetchBusiness = async () => {
      try {
        const res = await apiClient.get(`/public/business/${countryCode}/${businessSlug}`);
        const data = res.data;
        // The primary business type selects the reservation experience.
        // Enabled modules extend that business without replacing its primary flow.
        if (data.businessType === "hotel") {
          setBusiness(data);
          setIsLoading(false);
          return;
        }
        const maximumGuestCapacity =
          getMaximumConfiguredServicePointCapacity(data.servicePoints || []);
        if (maximumGuestCapacity !== null) {
          setFormData((current) => ({
            ...current,
            guestCount: Math.min(current.guestCount, maximumGuestCapacity),
          }));
        }
        if (data.settings?.reservationsEnabled === false) {
          setError("Reservations are currently disabled for this business.");
        } else {
          setBusiness(data);
        }
      } catch {
        setError("Business not found or not currently available.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchBusiness();
  }, [businessSlug, countryCode]);


  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const fingerprint = JSON.stringify({ countryCode, businessSlug, ...formData });
      if (reservationAttemptRef.current?.fingerprint !== fingerprint) {
        reservationAttemptRef.current = {
          fingerprint,
          key: `restaurant:${crypto.randomUUID()}`,
        };
      }
      await apiClient.post("/public/reservations", { 
        ...formData, 
        businessSlug,
        countryCode,
        seatingPreference: "no_preference",
        servicePointId: formData.servicePointId || null,
      }, {
        headers: { "Idempotency-Key": reservationAttemptRef.current.key },
      });
      setSuccess(true);
    } catch (err: any) {
      const status = err.response?.status;
      if (formData.servicePointId && (status === 400 || status === 409)) {
        setError(
          "That table is no longer available. Please choose another table or No preference.",
        );
        setFormData((current) => ({ ...current, servicePointId: "" }));
        setAvailabilityRefreshVersion((version) => version + 1);
        setStep(1);
      } else if (status === 409) {
        setError(
          "No table is currently available for that time. Please review the refreshed options.",
        );
        setAvailabilityRefreshVersion((version) => version + 1);
        setStep(1);
      } else {
        setError(err.response?.data?.error || "An error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = getBusinessLocalReservationDate(business?.timezone || "UTC");
  const primaryColor = business?.branding?.primaryColor || "#EA601A";
  const logoUrl = business?.logoUrl;
  const displayName = business?.displayName || "Restaurant";

  // ── Date picker state ────────────────────────────────────────────────────────
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [availability, setAvailability] = useState<RestaurantAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityRefreshVersion, setAvailabilityRefreshVersion] = useState(0);

  useEffect(() => {
    if (!business || business.businessType === "hotel" || prefillAppliedRef.current) {
      return;
    }

    prefillAppliedRef.current = true;
    const prefill = parseRestaurantReservationPrefill(searchParams, {
      businessLocalToday: getBusinessLocalReservationDate(business.timezone || "UTC"),
    });
    if (prefill.notice) {
      setHandoffNotice(prefill.notice);
    }
    if (!prefill.date && !prefill.partySize) {
      return;
    }

    if (prefill.date) {
      const [year, month] = prefill.date.split("-").map(Number);
      setCalendarMonth(new Date(year, month - 1, 1));
      pendingPrefilledStartTimeRef.current = prefill.startTime;
    }

    setFormData((current) => ({
      ...current,
      ...(prefill.date
        ? {
            date: prefill.date,
            startTime: prefill.startTime || "",
            endTime: "",
          }
        : {}),
      ...(prefill.partySize ? { guestCount: prefill.partySize } : {}),
    }));
  }, [business, searchParams]);

  useEffect(() => {
    const preferredStartTime = pendingPrefilledStartTimeRef.current;
    if (!preferredStartTime || availabilityLoading || !availability) {
      return;
    }

    pendingPrefilledStartTimeRef.current = null;
    if (!availability.availableStartTimes.includes(preferredStartTime)) {
      setFormData((current) =>
        current.startTime === preferredStartTime
          ? { ...current, startTime: "", endTime: "" }
          : current,
      );
      setHandoffNotice(
        "The requested time is no longer available. Please choose from the current availability.",
      );
    }
  }, [availability, availabilityLoading]);

  useEffect(() => {
    if (!business || !formData.date) {
      setAvailability(null);
      return;
    }
    const controller = new AbortController();
    const month = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
    setAvailabilityLoading(true);
    apiClient.get<RestaurantAvailability>("/public/reservations/restaurant-availability", {
      params: {
        businessSlug,
        countryCode,
        date: formData.date,
        month,
        partySize: formData.guestCount,
        durationMinutes: formData.durationMinutes,
        ...(formData.startTime ? { startTime: formData.startTime } : {}),
      },
      signal: controller.signal,
    }).then(({ data }) => {
      setAvailability(data);
      setFormData((current) => {
        if (
          current.servicePointId &&
          !data.servicePoints.some((point) =>
            point.servicePointId === current.servicePointId
          )
        ) {
          return { ...current, servicePointId: "" };
        }
        return current;
      });
      setError((current) =>
        current?.startsWith("That table is no longer available") ||
        current?.startsWith("No table is currently available")
          ? null
          : current
      );
    }).catch((requestError) => {
      if (requestError?.code !== "ERR_CANCELED") {
        setAvailability(null);
        setError(requestError.response?.data?.error || "Could not check current availability.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setAvailabilityLoading(false);
    });
    return () => controller.abort();
  }, [
    business,
    businessSlug,
    countryCode,
    calendarMonth,
    formData.date,
    formData.durationMinutes,
    formData.guestCount,
    formData.startTime,
    availabilityRefreshVersion,
  ]);

  const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const CAL_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  const calendarCells = (() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  })();

  const isDateClosed = (dateStr: string) => {
    if (!business?.operatingHours) return false;
    const dayOfWeek = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
    const cfg = business.operatingHours[dayOfWeek];
    return !cfg || !cfg.enabled;
  };

  const handleDateChange = (newDate: string) => {
    if (business?.operatingHours) {
      const dayOfWeek = new Date(newDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
      const cfg = business.operatingHours[dayOfWeek];
      if (!cfg || !cfg.enabled) {
        setError("The business is closed on this date. Please select another day.");
      } else {
        setError(null);
      }
    }
    setFormData(p => ({
      ...p,
      date: newDate,
      startTime: "",
      endTime: "",
    }));
    setShowCalendar(false);
  };

  const startTimeSlots = availability?.availableStartTimes || [];
  const endTimeSlots = formData.startTime ? availability?.validEndTimes || [] : [];

  const reservableServicePoints = business?.servicePoints || [];
  const maximumGuestCapacity =
    getMaximumConfiguredServicePointCapacity(reservableServicePoints);
  const guestCapacity = maximumGuestCapacity;
  const availableServicePoints =
    !availabilityLoading && formData.date && formData.startTime && formData.endTime
      ? availability?.servicePoints || []
      : [];
  const selectedServicePoint = availableServicePoints.find(
    (point) => point.servicePointId === formData.servicePointId,
  );
  const selectedServicePointIsAvailable =
    !formData.servicePointId || Boolean(selectedServicePoint);

  const canProceedStep0 = Boolean(
    formData.date &&
    formData.startTime &&
    formData.endTime &&
    availability?.availableStartTimes.includes(formData.startTime) &&
    availability.validEndTimes.includes(formData.endTime) &&
    availability.noPreferenceAvailable &&
    !availabilityLoading
  );
  const canProceedStep1 =
    formData.guestCount >= 1 &&
    (guestCapacity === null || formData.guestCount <= guestCapacity) &&
    Boolean(availability?.noPreferenceAvailable) &&
    selectedServicePointIsAvailable &&
    !availabilityLoading;
  const canProceedStep2 = formData.customerName.trim() && formData.phone.trim() && formData.email.trim();

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <ReservationPageSkeleton />;
  }

  // ── Not Found ──────────────────────────────────────────────────────────────
  if (!business) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full bg-card border rounded-2xl p-8 text-center shadow-sm">
          <Utensils className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold mb-2 text-foreground">Business Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "Business not found or not currently available."}</p>
          <button onClick={() => router.back()} className="text-primary font-semibold hover:underline">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="max-w-md w-full"
        >
          <div className="bg-card border shadow-xl rounded-3xl p-8 text-center">
            {/* Animated checkmark */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              className="flex flex-col items-center text-center mt-6"
            >
              <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4">
                <PartyPopper className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Place Reserved!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you, {formData.customerName.split(" ")[0]}! We've received your reservation for {formData.guestCount} {formData.guestCount === 1 ? 'guest' : 'guests'} on {formatDateDisplay(formData.date)} from {formData.startTime ? formatTime(formData.startTime) : ""} to {formData.endTime ? formatTime(formData.endTime) : ""}.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <button
                onClick={() => router.push(`/b/${countryCode}/${businessSlug}`)}
                className="w-full py-3.5 rounded-2xl font-bold text-white transition-all shadow-md hover:shadow-lg active:scale-95"
                style={{ backgroundColor: primaryColor }}
              >
                Back to Hub
              </button>
            </motion.div>
          </div>
        </motion.div>
      </main>
    );
  }

  // ── Hotel Flow ─────────────────────────────────────────────────────────────
  if (business?.businessType === "hotel") {
    return (
      <HotelReservationFlow
        business={business}
        countryCode={countryCode}
        businessSlug={businessSlug}
      />
    );
  }

  // ── Main Reservation Form ──────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen bg-background pb-16"
      style={{ "--theme-primary": primaryColor } as React.CSSProperties}
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={() => (step > 0 ? setStep(step - 1) : router.push(`/b/${countryCode}/${businessSlug}`))}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>

          {/* Logo + name */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: primaryColor }}>
                {displayName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium truncate">Reserve a Place</p>
              <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 shrink-0">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i > step ? "bg-muted" : ""}`}
                style={i <= step ? {
                  width: i === step ? "20px" : "6px",
                  backgroundColor: primaryColor,
                } : { width: "6px" }}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pt-8">
        {/* Step label */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: primaryColor }}>
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="text-2xl font-black text-foreground">
            {step === 0 && "Choose Date & Time"}
            {step === 1 && "Reservation Details"}
            {step === 2 && "Your Contact Info"}
            {step === 3 && "Review & Confirm"}
          </h2>
        </div>

        {handoffNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm font-medium text-foreground"
          >
            {handoffNotice}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm font-medium"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* ── Step 0: Date & Time ─────────────────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* ── Date picker ── */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <label className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
                  <CalendarDays className="w-4 h-4" style={{ color: primaryColor }} />
                  Select Date
                </label>

                {/* Trigger button */}
                <button
                  type="button"
                  onClick={() => setShowCalendar(v => !v)}
                  className="w-full p-3 rounded-xl border border-border bg-background text-left font-medium flex items-center justify-between gap-2 transition-colors hover:bg-muted/30 focus:outline-none"
                >
                  <span className={formData.date ? "text-foreground" : "text-muted-foreground"}>
                    {formData.date ? formatDateDisplay(formData.date) : "Select a date"}
                  </span>
                  <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>

                {/* Inline calendar */}
                {showCalendar && (
                  <div className="mt-3 border border-border rounded-xl overflow-hidden">
                    {/* Month nav */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                      <button
                        type="button"
                        onClick={() => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() - 1); setCalendarMonth(d); }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-bold text-foreground">
                        {CAL_MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={() => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() + 1); setCalendarMonth(d); }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 bg-muted/10">
                      {CAL_DAYS.map(d => (
                        <div key={d} className="py-2 text-center text-xs font-bold text-muted-foreground">{d}</div>
                      ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 p-2 gap-1">
                      {calendarCells.map((day, idx) => {
                        if (!day) return <div key={`e-${idx}`} />;
                        const y = calendarMonth.getFullYear();
                        const m = calendarMonth.getMonth();
                        const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isPast = dateStr < today;
                        const isClosed = isDateClosed(dateStr);
                        const isSelected = dateStr === formData.date;
                        const isUnavailable = Boolean(
                          availability && !availability.availableDates.includes(dateStr),
                        );
                        const isDisabled = isPast || isClosed || isUnavailable;
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => handleDateChange(dateStr)}
                            className={`w-full aspect-square flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                              isDisabled ? "text-muted-foreground/30 cursor-not-allowed" : "hover:bg-muted"
                            } ${isSelected ? "font-black text-white" : ""}`}
                            style={isSelected ? { backgroundColor: primaryColor } : {}}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Time selection — always visible ── */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Clock className="w-4 h-4" style={{ color: primaryColor }} />
                  Reservation Time
                </label>

                <div className="flex gap-3">
                  {/* Start time */}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Start Time</label>
                    <div className="relative">
                      <select
                        value={formData.startTime}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setFormData(p => ({ ...p, startTime: newStart, endTime: "" }));
                        }}
                        className="w-full appearance-none p-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none pr-8"
                      >
                        <option value="">Select start time</option>
                        {startTimeSlots.map(slot => (
                          <option key={slot} value={slot}>{formatTime(slot)}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {/* End time */}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">End Time</label>
                    <div className="relative">
                      <select
                        value={formData.endTime}
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          const newDur = newEnd ? calculateDuration(formData.startTime, newEnd) : formData.durationMinutes;
                          setFormData(p => ({ ...p, endTime: newEnd, durationMinutes: newDur > 0 ? newDur : p.durationMinutes }));
                        }}
                        className="w-full appearance-none p-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none pr-8"
                      >
                        <option value="">Select end time</option>
                        {endTimeSlots.map(slot => (
                          <option key={slot} value={slot}>{formatTime(slot)}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Duration shortcuts — only when start time is picked */}
                {availabilityLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking live table availability…
                  </p>
                )}
                {!availabilityLoading && formData.date && startTimeSlots.length === 0 && (
                  <p className="text-xs text-destructive">No table is available for that party and duration.</p>
                )}

                {formData.startTime && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Duration</label>
                    <div className="flex flex-wrap gap-2">
                      {[{ label: "1h", mins: 60 }, { label: "1.5h", mins: 90 }, { label: "2h", mins: 120 }, { label: "3h", mins: 180 }].map(dur => (
                        <button
                          key={dur.label}
                          type="button"
                          onClick={() => {
                            const newEnd = addMinutes(formData.startTime, dur.mins);
                            setFormData(p => ({ ...p, durationMinutes: dur.mins, endTime: newEnd }));
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                          style={formData.durationMinutes === dur.mins ? {
                            backgroundColor: primaryColor, borderColor: primaryColor, color: "white",
                          } : { borderColor: "var(--border)" }}
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          )}


          {/* ── Step 1: Party Details ────────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Guest count */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <label className="flex items-center gap-2 text-sm font-bold text-foreground mb-4">
                  <Users className="w-4 h-4" style={{ color: primaryColor }} />
                  Number of Guests
                </label>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-5xl font-black text-foreground">{formData.guestCount}</p>
                    <p className="text-xs text-muted-foreground font-medium mt-1">
                      {formData.guestCount === 1 ? "guest" : "guests"}
                      {guestCapacity !== null ? ` · max ${guestCapacity}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      type="button"
                      disabled={formData.guestCount <= 1}
                      onClick={() => setFormData((p) => ({ ...p, guestCount: Math.max(1, p.guestCount - 1) }))}
                      className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center disabled:opacity-30 transition-all hover:border-current"
                      style={{ color: primaryColor }}
                    >
                      <Minus className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      type="button"
                      disabled={guestCapacity !== null && formData.guestCount >= guestCapacity}
                      onClick={() => setFormData((current) => ({
                        ...current,
                        guestCount: guestCapacity === null
                          ? current.guestCount + 1
                          : Math.min(guestCapacity, current.guestCount + 1),
                      }))}
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-all"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Plus className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Physical table request. The backend remains authoritative. */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <label className="flex items-center gap-2 text-sm font-bold text-foreground mb-1">
                  <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                  Choose your table
                </label>
                <p className="text-xs text-muted-foreground mb-4">
                  Select an available table, or let us choose one for you.
                </p>

                {availabilityLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mb-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Refreshing available tables...
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    disabled={availabilityLoading || !availability?.noPreferenceAvailable}
                    onClick={() => setFormData((current) => ({
                      ...current,
                      servicePointId: "",
                    }))}
                    className="flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all disabled:opacity-50"
                    style={!formData.servicePointId ? {
                      borderColor: primaryColor,
                      backgroundColor: `${primaryColor}10`,
                    } : { borderColor: "var(--border)" }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: !formData.servicePointId
                          ? `${primaryColor}20`
                          : "var(--muted)",
                        color: !formData.servicePointId
                          ? primaryColor
                          : "var(--muted-foreground)",
                      }}
                    >
                      <LayoutGrid className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">No preference</p>
                      <p className="text-xs text-muted-foreground">
                        Let us choose an available table for you.
                      </p>
                    </div>
                  </motion.button>

                  {availableServicePoints.map((servicePoint) => {
                    const isSelected =
                      formData.servicePointId === servicePoint.servicePointId;
                    return (
                      <motion.button
                        key={servicePoint.servicePointId}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => setFormData((current) => ({
                          ...current,
                          servicePointId: servicePoint.servicePointId,
                        }))}
                        className="flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                        style={isSelected ? {
                          borderColor: primaryColor,
                          backgroundColor: `${primaryColor}10`,
                        } : { borderColor: "var(--border)" }}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: isSelected
                              ? `${primaryColor}20`
                              : "var(--muted)",
                            color: isSelected
                              ? primaryColor
                              : "var(--muted-foreground)",
                          }}
                        >
                          <MapPin className="w-[18px] h-[18px]" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {servicePoint.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {servicePoint.capacity
                              ? `Seats up to ${servicePoint.capacity}`
                              : "Reservable space"}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {!availabilityLoading && availableServicePoints.length === 0 && (
                  <p className="text-xs text-destructive mt-3">
                    No table is currently available for this party and time.
                  </p>
                )}
              </div>

            </motion.div>
          )}

          {/* ── Step 2: Contact Info ─────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <GuestDetailsForm
                data={formData as GuestDetailsData}
                onChange={(newData) => setFormData((p) => ({ ...p, ...newData }))}
                primaryColor={primaryColor}
              />
            </motion.div>
          )}

          {/* ── Step 3: Review & Confirm ─────────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Business summary strip */}
              <div
                className="rounded-2xl p-5 text-white shadow-lg"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                      {displayName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-black text-lg leading-tight">{displayName}</p>
                    {business.address && (
                      <p className="text-xs text-white/75 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {business.address}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mt-4">
                  <div className="bg-white/15 rounded-xl py-2.5 px-2">
                    <p className="text-[10px] uppercase tracking-wide text-white/70 mb-0.5">Date</p>
                    <p className="text-xs font-bold leading-tight">{formData.date ? new Date(formData.date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</p>
                  </div>
                  <div className="bg-white/15 rounded-xl py-2.5 px-2">
                    <p className="text-[10px] uppercase tracking-wide text-white/70 mb-0.5">Time</p>
                    <p className="text-xs font-bold leading-tight">
                      {formData.startTime && formData.endTime
                        ? `${formatTime(formData.startTime)} – ${formatTime(formData.endTime)}`
                        : "—"}
                    </p>
                  </div>
                  <div className="bg-white/15 rounded-xl py-2.5 px-2">
                    <p className="text-[10px] uppercase tracking-wide text-white/70 mb-0.5">Guests</p>
                    <p className="text-xs font-bold">{formData.guestCount}</p>
                  </div>
                </div>
              </div>

              {/* Details review */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {[
                  { icon: User, label: "Name", value: formData.customerName },
                  { icon: Phone, label: "Phone", value: formData.phone },
                  { icon: Mail, label: "Email", value: formData.email || "Not provided" },
                  {
                    icon: Sparkles,
                    label: "Table preference",
                    value: selectedServicePoint?.label || "No preference",
                  },
                  ...(formData.specialRequest ? [{ icon: MessageSquare, label: "Request", value: formData.specialRequest }] : []),
                ].map(({ icon: Icon, label, value }, i, arr) => (
                  <div
                    key={label}
                    className={`flex items-start gap-3 px-5 py-3.5 ${i < arr.length - 1 ? "border-b border-border/50" : ""}`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <p className="text-sm text-foreground font-semibold truncate">{value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(
                        label === "Name" || label === "Phone" || label === "Email"
                          ? 2
                          : 1
                      )}
                      className="text-xs font-bold shrink-0"
                      style={{ color: primaryColor }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center px-4 leading-relaxed">
                By submitting, you agree to our terms. The restaurant will confirm your reservation.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex-1 py-4 rounded-2xl font-bold border border-border bg-card hover:bg-muted transition-colors text-foreground flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              disabled={
                (step === 0 && !canProceedStep0) ||
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2)
              }
              onClick={() => setStep(step + 1)}
              className="flex-1 py-4 rounded-2xl font-bold text-white transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex-1 py-4 rounded-2xl font-bold text-white transition-all shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Confirm Reservation
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </main>
  );
}
