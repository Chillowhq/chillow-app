"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Calendar, Users, Phone,
  Mail, ChevronDown, Search, CalendarDays, AlertCircle,
  CircleDot, ToggleLeft, ToggleRight,
  LayoutList, KeyRound,
  Send, ShieldAlert, Plus, LogIn, LogOut, Home, BedDouble,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import apiClient from "@/lib/axios-config";
import { useAuthContext } from "@/contexts/AuthContext";
import { hasManagementPermission, MANAGER_PERMISSIONS } from "@/lib/manager-permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  formatReservationDate as formatDate,
  isReservationToday as isToday,
} from "@/lib/reservation-date";
import {
  useReservationDashboard,
} from "@/components/reservations/dashboard/useReservationDashboard";
import { ReservationStatusBadge } from "@/components/reservations/dashboard/ReservationStatusBadge";
import { ReservationPaymentStatusBadge } from "@/components/reservations/dashboard/ReservationPaymentStatusBadge";
import { ReservationDeleteDialog } from "@/components/reservations/dashboard/ReservationDeleteDialog";
import { ReservationContentSkeleton } from "@/components/reservations/dashboard/ReservationContentSkeleton";
import { HotelReservationActionsMenu } from "@/components/reservations/dashboard/HotelReservationActionsMenu";
import {
  HotelReservationCancellationDialog,
  type ReservationCancellationRequest,
} from "@/components/reservations/dashboard/HotelReservationCancellationDialog";
import type { HotelReservationActionId } from "@/components/reservations/dashboard/hotel-reservation-actions";
import type { ReservationDashboardRecord } from "@/components/reservations/dashboard/useReservationDashboard";
import { StaffHotelReservationDialog } from "@/components/reservations/dashboard/StaffHotelReservationDialog";
import { HotelTodayView } from "@/components/reservations/dashboard/hotel/HotelTodayView";
import { HotelCalendarTapeChart } from "@/components/reservations/dashboard/hotel/HotelCalendarTapeChart";

function maskGuestEmail(value?: string) {
  const email = String(value || "").trim();
  const separatorIndex = email.indexOf("@");
  if (separatorIndex <= 0) return "Email unavailable";
  return `${email.charAt(0)}*****${email.slice(separatorIndex)}`;
}

export function HotelReservationsDashboard() {
  const { user } = useAuthContext();
  const canManageReservations = hasManagementPermission(user, MANAGER_PERMISSIONS.RESERVATIONS_MANAGE);
  const canManageOperationalSettings = hasManagementPermission(user, MANAGER_PERMISSIONS.SETTINGS_OPERATIONAL_MANAGE);
  const canReadServicePoints = hasManagementPermission(user, MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW);
  const {
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
    servicePoints,
    updateStatus,
    handleDeleteClick,
    confirmDelete,
    toggleReservations,
    stats,
    operations,
    businessDate,
    clientToday,
    filtered,
    setListCursor,
    setPreviousCursor,
    pagination,
  } = useReservationDashboard({
    businessId: user?.businessId,
    mode: "stay",
    canReadServicePoints,
  });
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  const [linkedReservation, setLinkedReservation] =
    useState<ReservationDashboardRecord | null>(null);
  const [checkInReservation, setCheckInReservation] =
    useState<ReservationDashboardRecord | null>(null);
  const [checkInCode, setCheckInCode] = useState("");
  const [checkInCodeLocked, setCheckInCodeLocked] = useState(false);
  const [checkInCodeResent, setCheckInCodeResent] = useState(false);
  const [cancellationReservation, setCancellationReservation] =
    useState<ReservationDashboardRecord | null>(null);
  const [cancellationRequestKey, setCancellationRequestKey] = useState<
    string | null
  >(null);

  useEffect(() => {
    const reservationId = new URLSearchParams(window.location.search).get("reservationId");
    if (!reservationId) return;
    setViewMode("all");
    setFilterDate("");
    setFilterStatus("all");
    setDeepLinkError(null);
    void apiClient.get<{ reservation: ReservationDashboardRecord }>("/owner/reservations", {
      params: { reservationId, mode: "stay" },
    }).then(({ data }) => {
      setLinkedReservation(data.reservation);
    }).catch(() => {
      setDeepLinkError("This reservation is no longer available or you do not have access to it.");
    });
    // This is intentionally URL-driven once on destination entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!linkedReservation || isLoading) return;
    setReservations((current) => [
      linkedReservation,
      ...current.filter((reservation) => reservation._id !== linkedReservation._id),
    ]);
    setExpandedId(linkedReservation._id);
    setLinkedReservation(null);
  }, [isLoading, linkedReservation, setExpandedId, setReservations]);
  const canRefund = ["owner", "co_owner"].includes(user?.role || "");
  const [newBookingDialogOpen, setNewBookingDialogOpen] = useState(false);
  const canResendCheckInCode = [
    "owner",
    "co_owner",
    "restaurant_owner",
    "admin",
  ].includes(user?.role || "");
  const isCheckInBusy =
    Boolean(checkInReservation) &&
    actionLoadingId === checkInReservation?._id;
  const maskedCheckInEmail = maskGuestEmail(checkInReservation?.email);

  const openCheckInDialog = (reservation: ReservationDashboardRecord) => {
    setCheckInReservation(reservation);
    setCheckInCode("");
    setCheckInCodeLocked(Boolean(reservation.checkInCodeLockedAt));
    setCheckInCodeResent(false);
    setCheckInDialogOpen(true);
  };

  const closeCheckInDialog = () => {
    setCheckInDialogOpen(false);
    setCheckInReservation(null);
    setCheckInCode("");
    setCheckInCodeLocked(false);
    setCheckInCodeResent(false);
  };

  const openCancellationDialog = (reservation: ReservationDashboardRecord) => {
    setCancellationReservation(reservation);
    setCancellationRequestKey(null);
  };

  const confirmCancellation = async (
    request: ReservationCancellationRequest,
  ) => {
    if (!cancellationReservation) return;

    const requestKey =
      cancellationRequestKey ||
      globalThis.crypto?.randomUUID?.() ||
      `reservation-cancellation-${Date.now()}-${Math.random()}`;
    if (!cancellationRequestKey) setCancellationRequestKey(requestKey);

    setActionLoadingId(cancellationReservation._id);
    try {
      const response = await apiClient.post(
        `/owner/reservations/${cancellationReservation._id}/cancel`,
        request,
        { headers: { "Idempotency-Key": requestKey } },
      );
      const updatedReservation = response.data?.reservation;
      if (updatedReservation) {
        setReservations((current) =>
          current.map((reservation) =>
            reservation._id === cancellationReservation._id
              ? { ...reservation, ...updatedReservation }
              : reservation,
          ),
        );
      }

      if (response.data?.refundPending) {
        toast.info(
          response.data?.message ||
            "The refund is processing. The reservation remains confirmed.",
        );
      } else if (response.data?.emailStatus === "failed") {
        toast.warning(
          "Cancellation completed, but the guest notification email failed.",
        );
      } else {
        toast.success(response.data?.message || "Reservation cancelled.");
      }
      setCancellationReservation(null);
      setCancellationRequestKey(null);
    } catch (requestError: any) {
      const code = requestError.response?.data?.code;
      if (
        code === "REFUND_PROVIDER_FAILED" ||
        code === "REFUND_RETRY_REQUIRES_NEW_KEY"
      ) {
        // Stripe explicitly rejected this operation, so a deliberate retry
        // must receive a fresh provider idempotency key.
        setCancellationRequestKey(null);
      }
      toast.error(
        requestError.response?.data?.error ||
          "Failed to cancel the reservation.",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmCheckIn = async () => {
    if (!checkInReservation || !/^\d{6}$/.test(checkInCode)) return;

    setActionLoadingId(checkInReservation._id);
    try {
      const response = await apiClient.post(
        `/owner/reservations/${checkInReservation._id}/check-in`,
        { code: checkInCode },
      );
      const updatedReservation = response.data?.reservation;
      setReservations((prev) => prev.map((reservation) =>
        reservation._id === checkInReservation._id
          ? { ...reservation, ...(updatedReservation || {}), status: "checked_in" }
          : reservation
      ));
      toast.success(response.data?.message || "Guest checked in successfully.");
      setCheckInDialogOpen(false);
      setCheckInReservation(null);
      setCheckInCode("");
    } catch (err: any) {
      const responseData = err.response?.data;
      const message = responseData?.error || "Failed to check in guest.";
      const attemptsRemaining = responseData?.attemptsRemaining;
      if (
        err.response?.status === 423 ||
        responseData?.code === "CHECK_IN_CODE_LOCKED"
      ) {
        const lockedAt = responseData?.lockedAt || new Date().toISOString();
        setCheckInCode("");
        setCheckInCodeLocked(true);
        setCheckInCodeResent(false);
        setCheckInReservation((current) =>
          current ? { ...current, checkInCodeLockedAt: lockedAt } : current,
        );
        setReservations((current) =>
          current.map((reservation) =>
            reservation._id === checkInReservation._id
              ? { ...reservation, checkInCodeLockedAt: lockedAt }
              : reservation,
          ),
        );
      }
      toast.error(
        typeof attemptsRemaining === "number"
          ? `${message} ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`
          : message
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const resendCheckInCode = async () => {
    if (!checkInReservation || !canResendCheckInCode) return;

    setActionLoadingId(checkInReservation._id);
    try {
      const response = await apiClient.post(
        `/owner/reservations/${checkInReservation._id}/resend-confirmation`,
      );
      const updatedReservation = response.data?.reservation;
      const resetReservation = {
        ...checkInReservation,
        ...(updatedReservation || {}),
        checkInCodeLockedAt: null,
        checkInCodeFailedAttempts: 0,
      };

      setReservations((current) =>
        current.map((reservation) =>
          reservation._id === checkInReservation._id
            ? { ...reservation, ...resetReservation }
            : reservation,
        ),
      );
      setCheckInReservation(resetReservation);
      setCheckInCode("");
      setCheckInCodeLocked(false);
      setCheckInCodeResent(true);
      toast.success(
        response.data?.message || "A new check-in code was sent to the guest.",
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Failed to send a new check-in code.",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  async function handleReservationAction(
    reservation: any,
    action: HotelReservationActionId,
  ) {
    switch (action) {
      case "accept":
        await updateStatus(reservation._id, "accepted_awaiting_payment");
        return;
      case "decline":
        openCancellationDialog(reservation);
        return;
      case "cancel":
        openCancellationDialog(reservation);
        return;
      case "check_in":
        openCheckInDialog(reservation);
        return;
      case "check_out":
        await updateStatus(reservation._id, "checked_out");
        return;
      case "view":
        setViewMode("all");
        setExpandedId(reservation._id);
        return;
      case "archive":
        handleDeleteClick(reservation._id);
        return;
      case "resend_payment_link":
        setActionLoadingId(reservation._id);
        try {
          const response = await apiClient.post(
            `/owner/reservations/${reservation._id}/resend-payment-link`,
          );
          const updatedReservation = response.data?.reservation;
          if (updatedReservation) {
            setReservations((current) =>
              current.map((item) =>
                item._id === reservation._id
                  ? { ...item, ...updatedReservation }
                  : item,
              ),
            );
          }
          toast.success(
            response.data?.message || "Payment link resent successfully.",
          );
        } catch (requestError: any) {
          const updatedReservation =
            requestError.response?.data?.reservation;
          if (updatedReservation) {
            setReservations((current) =>
              current.map((item) =>
                item._id === reservation._id
                  ? { ...item, ...updatedReservation }
                  : item,
              ),
            );
          }
          toast.error(
            requestError.response?.data?.error ||
              "Failed to resend the payment link.",
          );
        } finally {
          setActionLoadingId(null);
        }
        return;
      case "copy_payment_link":
        if (!reservation.paymentUrl) {
          toast.error("This reservation does not have an active payment link.");
          return;
        }
        try {
          await navigator.clipboard.writeText(reservation.paymentUrl);
          toast.success("Payment link copied.");
        } catch {
          toast.error("Could not copy the payment link.");
        }
    }
  }

  function renderActionsMenu(reservation: any) {
    if (!canManageReservations) return null;
    return (
      <HotelReservationActionsMenu
        reservation={{ ...reservation, canRefund }}
        isBusy={actionLoadingId === reservation._id}
        onAction={(action) => handleReservationAction(reservation, action)}
      />
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="pb-20">
      {/* Header */}
      <header className="sticky top-0 lg:top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-primary" />
              Reservations
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage bookings, arrivals, stays and departures</p>
          </div>
          {canManageOperationalSettings && <button
            onClick={toggleReservations}
            disabled={isLoading || isTogglingReservations}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-semibold disabled:opacity-60 ${reservationsEnabled
                ? "bg-background border-border text-muted-foreground hover:text-foreground"
                : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            title={reservationsEnabled ? "Online reservations are accepting bookings" : "Online reservations are paused"}
          >
            {isLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <>
                <span className="text-muted-foreground">Online Reservations</span>
                {isTogglingReservations ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : reservationsEnabled ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-red-500" />}
                <span className={reservationsEnabled ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{reservationsEnabled ? "On" : "Off"}</span>
              </>
            )}
          </button>}
          {canManageReservations && (
            <button
              onClick={() => setNewBookingDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-bold"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Booking</span>
            </button>
          )}
        </div>
      </header>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        {/* PMS Tab Nav */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1 w-full sm:w-auto">
          {([
            { id: "today", label: "Today", icon: CalendarDays },
            { id: "calendar", label: "Calendar", icon: CalendarDays },
            { id: "all", label: "All Reservations", icon: LayoutList },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {deepLinkError && (
          <div className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-sm font-medium flex items-center gap-2 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="status">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> {deepLinkError}
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ── TODAY ─────────────────────────────────────────────────────────── */}
        {viewMode === "today" && (
          <>
            {/* Operational Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Arrivals Today */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-blue-600 bg-blue-50 dark:bg-blue-950/30">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Arrivals Today</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-7 w-10" />
                  ) : (
                    <>
                      <p className="text-2xl font-black text-foreground leading-tight">{stats.arrivalsToday?.total ?? 0}</p>
                      {(stats.arrivalsToday?.checkedIn > 0 || stats.arrivalsToday?.remaining > 0) && (
                        <p className="text-xs text-muted-foreground mt-0.5">{stats.arrivalsToday?.checkedIn ?? 0} checked in · {stats.arrivalsToday?.remaining ?? 0} remaining</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Departures Today */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-orange-600 bg-orange-50 dark:bg-orange-950/30">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Departures Today</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-7 w-10" />
                  ) : (
                    <>
                      <p className="text-2xl font-black text-foreground leading-tight">{stats.departuresToday?.total ?? 0}</p>
                      {(stats.departuresToday?.checkedOut > 0 || stats.departuresToday?.remaining > 0) && (
                        <p className="text-xs text-muted-foreground mt-0.5">{stats.departuresToday?.checkedOut ?? 0} checked out · {stats.departuresToday?.remaining ?? 0} remaining</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* In-House */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-green-600 bg-green-50 dark:bg-green-950/30">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">In-House</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-7 w-10" />
                  ) : (
                    <>
                      <p className="text-2xl font-black text-foreground leading-tight">{stats.inHouse?.reservations ?? 0}</p>
                      {stats.inHouse?.guests > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">{stats.inHouse?.guests} {stats.inHouse?.guests === 1 ? "guest" : "guests"}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Available Tonight */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-purple-600 bg-purple-50 dark:bg-purple-950/30">
                  <BedDouble className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Available Tonight</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-7 w-10" />
                  ) : (
                    <>
                      <p className="text-2xl font-black text-foreground leading-tight">{stats.availableTonight?.available ?? "—"}</p>
                      {stats.availableTonight?.totalRooms > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">of {stats.availableTonight?.totalRooms} rooms</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {isLoading ? (
              <ReservationContentSkeleton view="list" />
            ) : (
              <HotelTodayView
                operations={operations}
                businessDate={businessDate || new Date().toISOString().split("T")[0]}
                onReservationClick={(r) => { setExpandedId(r._id); setViewMode("all"); }}
                renderActionsMenu={renderActionsMenu}
              />
            )}
          </>
        )}

        {/* ── CALENDAR ──────────────────────────────────────────────────────── */}
        {viewMode === "calendar" && (
          isLoading ? (
            <ReservationContentSkeleton view="calendar" />
          ) : (
          <HotelCalendarTapeChart
              reservations={reservations}
              servicePoints={servicePoints}
              clientToday={clientToday}
              startDateStr={calendarDate.toISOString().split("T")[0]}
              daysToShow={calendarDays}
              onStartDateChange={(newStart) => {
                const d = new Date(`${newStart}T12:00:00Z`);
                setCalendarDate(d);
              }}
              onDaysToShowChange={(days) => setCalendarDays(days)}
              onReservationClick={(r) => { setExpandedId(r._id); setViewMode("all"); }}
            />
          )
        )}

        {/* ── ALL RESERVATIONS ──────────────────────────────────────────────── */}
        {viewMode === "all" && (
          <>
            {/* Filters */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0 border border-border rounded-xl px-3 py-2 bg-background">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    aria-label="Search reservations"
                    placeholder="Search by name, phone, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background sm:w-44">
                  <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="date"
                    aria-label="Filter reservations by check-in date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="flex-1 bg-transparent text-sm focus:outline-none text-foreground"
                  />
                </div>
                <div className="relative sm:w-44">
                  <select
                    aria-label="Filter reservations by status"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full appearance-none border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none pr-8 font-medium"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="accepted_awaiting_payment">Accepted</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="declined">Declined</option>
                    <option value="no_show">No Show</option>
                    <option value="expired">Expired</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              {(filterDate || filterStatus !== "all" || searchQuery) && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground font-medium">
                    Showing <span className="font-bold text-foreground">{filtered.length}</span> of {pagination.totalCount} reservations
                  </p>
                  <button onClick={() => { setFilterDate(""); setFilterStatus("all"); setSearchQuery(""); setListSortBy("checkInDate"); setListSortDirection("desc"); }} className="text-xs font-bold text-primary hover:underline">
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            {isLoading ? (
              <ReservationContentSkeleton view="list" />
            ) : error ? null : filtered.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-16 flex flex-col items-center text-center shadow-sm">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Calendar className="w-7 h-7 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold mb-2 text-foreground">
                  {reservations.length === 0 ? "No Reservations Yet" : "No Results Found"}
                </h2>
                <p className="text-muted-foreground max-w-sm text-sm">
                  {reservations.length === 0 ? "When guests book through your hotel portal, reservations will appear here." : "Try adjusting your filters or search query."}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="hidden lg:grid grid-cols-[1.8fr_1.4fr_0.8fr_1fr_1fr_1fr_0.8fr] gap-4 px-5 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (listSortBy === "createdAt") {
                          setListSortBy("checkInDate");
                          setListSortDirection("asc");
                        } else if (listSortBy === "checkInDate" && listSortDirection === "asc") {
                          setListSortBy("checkInDate");
                          setListSortDirection("desc");
                        } else {
                          setListSortBy("createdAt");
                          setListSortDirection("desc");
                        }
                      }}
                      className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 hover:text-foreground transition-colors"
                      aria-label="Toggle Stay sorting"
                    >
                      STAY
                      {listSortBy === "checkInDate" && listSortDirection === "asc" && <ArrowUp className="w-3 h-3" />}
                      {listSortBy === "checkInDate" && listSortDirection === "desc" && <ArrowDown className="w-3 h-3" />}
                    </button>
                  </div>
                  {["Guest", "Guests", "Room", "Booking Status", "Payment", "Actions"].map((h) => (
                    <p key={h} className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</p>
                  ))}
                </div>
                <div className="divide-y divide-border/50">
                  {filtered.map((r) => {
                    const isExpanded = expandedId === r._id;
                    return (
                      <div key={r._id} className="transition-colors hover:bg-muted/20">
                        <div
                          className="grid grid-cols-1 lg:grid-cols-[1.8fr_1.4fr_0.8fr_1fr_1fr_1fr_0.8fr] gap-3 lg:gap-4 items-start lg:items-center px-5 py-4 cursor-pointer lg:cursor-default"
                          onClick={() => setExpandedId(isExpanded ? null : r._id)}
                        >
                          <div>
                            <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              {formatDate(r.checkInDate)}
                              {isToday(r.checkInDate) && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">Today</span>}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                              → {formatDate(r.checkOutDate)}
                            </p>
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">{r.customerName}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {r.phone}</p>
                            {r.email && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 lg:hidden"><Mail className="w-3 h-3" /> {r.email}</p>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-semibold text-foreground">{r.guestCount}</span>
                          </div>
                          <div className="text-sm text-foreground font-medium">
                            {r.servicePointLabel || <span className="text-muted-foreground">—</span>}
                          </div>
                          <div><ReservationStatusBadge mode="stay" status={r.status} /></div>
                          <div>
                            <ReservationPaymentStatusBadge
                              paymentStatus={r.paymentStatus}
                              reservationStatus={r.status}
                              refundPending={r.refundPending}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            {renderActionsMenu(r)}
                            <button onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : r._id); }}
                              className="hidden lg:inline-flex p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-5 border-t border-border/50 bg-muted/10">
                            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                {r.email && (
                                  <div className="flex items-start gap-2">
                                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-xs text-muted-foreground font-medium">Email</p>
                                      <p className="text-sm text-foreground font-semibold">{r.email}</p>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-start gap-2">
                                  <CircleDot className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground font-medium">Source</p>
                                    <p className="text-sm text-foreground font-semibold">{r.source === "walk_in" ? "Walk-in" : r.source === "online" ? "Online" : r.source?.replace("_", " ") || "Online"}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground font-medium">Submitted</p>
                                    <p className="text-sm text-foreground font-semibold">{new Date(r.createdAt).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                              {r.specialRequest && (
                                <div>
                                  <p className="text-xs text-muted-foreground font-medium mb-2">Special Request</p>
                                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-200 italic">
                                    &quot;{r.specialRequest}&quot;
                                  </div>
                                </div>
                              )}
                              {r.paymentStatus === 'paid' && r.totalPrice && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-xs font-bold text-green-700 bg-green-100 dark:bg-green-950/30 px-3 py-1.5 rounded-lg">Paid: {r.totalPrice} {r.currency?.toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Pagination */}
                {(pagination.hasPreviousPage || pagination.hasNextPage) && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
                    <button
                      disabled={!pagination.hasPreviousPage || isLoading}
                      onClick={() => { setListCursor(null); setPreviousCursor(pagination.previousCursor); }}
                      className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-bold disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      ← Previous
                    </button>
                    <span className="text-xs font-medium text-muted-foreground">
                      Showing {filtered.length} of {pagination.totalCount}
                    </span>
                    <button
                      disabled={!pagination.hasNextPage || isLoading}
                      onClick={() => { setPreviousCursor(null); setListCursor(pagination.nextCursor); }}
                      className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-bold disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ReservationDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        isBusy={Boolean(actionLoadingId)}
        isDeleting={Boolean(actionLoadingId && deletingReservationId)}
      />

      <HotelReservationCancellationDialog
        open={Boolean(cancellationReservation)}
        reservation={cancellationReservation}
        canRefund={canRefund}
        isBusy={
          Boolean(cancellationReservation) &&
          actionLoadingId === cancellationReservation?._id
        }
        onOpenChange={(open) => {
          if (!open) {
            setCancellationReservation(null);
            setCancellationRequestKey(null);
          }
        }}
        onConfirm={confirmCancellation}
      />

      {/* Guest check-in dialog */}
      <Dialog
        open={checkInDialogOpen}
        onOpenChange={(open) => {
          if (isCheckInBusy) return;
          if (open) setCheckInDialogOpen(true);
          else closeCheckInDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {checkInCodeLocked ? (
                <ShieldAlert className="h-5 w-5 text-red-600" />
              ) : (
                <KeyRound className="h-5 w-5 text-blue-600" />
              )}
              {checkInCodeLocked ? "Check-in code locked" : "Check in guest"}
            </DialogTitle>
            <DialogDescription>
              {checkInCodeLocked ? (
                <>
                  Too many incorrect attempts were made. Send a new code to the
                  guest&apos;s registered email.
                </>
              ) : (
                <>
                  Enter the six-digit code from {checkInReservation?.customerName || "the guest"}&apos;s confirmation email
                  {checkInReservation?.servicePointLabel ? ` for ${checkInReservation.servicePointLabel}` : ""}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {checkInCodeLocked ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                Guest email
              </p>
              <p className="mt-1 font-medium text-foreground">
                {maskedCheckInEmail}
              </p>
            </div>
          ) : (
            <div className="py-3">
              {checkInCodeResent ? (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <p className="font-bold">
                    A new check-in code was sent to {maskedCheckInEmail}.
                  </p>
                  <p className="mt-1">Ask the guest for the new code.</p>
                </div>
              ) : null}
              <label htmlFor="hotel-check-in-code" className="mb-2 block text-sm font-bold text-foreground">
                Check-in code
              </label>
              <input
                id="hotel-check-in-code"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={checkInCode}
                onChange={(event) => setCheckInCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && /^\d{6}$/.test(checkInCode)) confirmCheckIn();
                }}
                placeholder="000000"
                disabled={isCheckInBusy}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.45em] text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              />
              <p className="mt-2 text-xs text-muted-foreground">The code is valid only during this reservation&apos;s check-in window.</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCheckInDialog}
              disabled={isCheckInBusy}
            >
              Cancel
            </Button>
            {checkInCodeLocked ? (
              canResendCheckInCode ? (
                <Button
                  onClick={resendCheckInCode}
                  disabled={isCheckInBusy}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isCheckInBusy ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" />Resend new code</>
                  )}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Owner authorization is required to resend this code.
                </p>
              )
            ) : (
              <Button
                onClick={confirmCheckIn}
                disabled={!/^\d{6}$/.test(checkInCode) || isCheckInBusy}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isCheckInBusy
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking in...</>
                  : <><KeyRound className="mr-2 h-4 w-4" />Check in guest</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StaffHotelReservationDialog
        open={newBookingDialogOpen}
        onOpenChange={setNewBookingDialogOpen}
        onSuccess={(newReservation) => {
          if (newReservation) {
            setReservations((current) => [newReservation, ...current]);
          }
        }}
      />
    </div>
  );
}
