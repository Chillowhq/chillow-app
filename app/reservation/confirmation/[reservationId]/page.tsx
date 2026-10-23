"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, CalendarDays, Users, Bed, Home, Clock, AlertTriangle } from "lucide-react";
import { ReservationDetailsSkeleton } from "@/components/customer-loading-skeletons";
import apiClient from "@/lib/axios-config";
import HotelPricingBreakdown from "@/components/reservations/hotel/HotelPricingBreakdown";
import { formatLongReservationDate as formatDate } from "@/lib/reservation-date";
import { getServicePointTerm } from "@/contexts/BusinessContext";


const servicePointTerm = getServicePointTerm();

export default function ReservationConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.reservationId as string;

  const [reservation, setReservation] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const confirmationSessionId = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    ).get("session_id")?.trim();

    if (!confirmationSessionId) {
      setLoadFailed(true);
      setIsVerifying(false);
      setIsLoading(false);
      return;
    }

    // The path ID is routing only. The Checkout Session capability is sent in
    // a header, never as a query parameter or raw-ID fallback.
    const fetchData = async (attempt = 0) => {
      try {
        const res = await apiClient.get(
          `/public/reservations/by-id/${reservationId}`,
          {
            headers: {
              "X-Reservation-Confirmation-Session": confirmationSessionId,
            },
          },
        );
        if (cancelled) return;
        const r = res.data.reservation;
        setReservation(r);
        setBusiness(res.data.business);
        setLoadFailed(false);

        // If still awaiting payment and we have attempts left, retry after 2s (Stripe webhook delay)
        if (r.status === "accepted_awaiting_payment" && attempt < 5) {
          retryTimer = setTimeout(() => fetchData(attempt + 1), 2000);
        } else {
          setIsVerifying(false);
        }
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
          setIsVerifying(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [reservationId]);

  if (isLoading) {
    return <ReservationDetailsSkeleton label="Confirming reservation" />;
  }

  const currency = (reservation?.currency || business?.currency || "USD").toUpperCase();
  const pricing = reservation?.pricing;
  const isPaid = reservation?.paymentStatus === "paid" || [
    "confirmed",
    "arrived",
    "checked_in",
    "checked_out",
    "completed",
  ].includes(reservation?.status);
  const terminalState = {
    cancelled: {
      title: "Reservation Cancelled",
      message: "This reservation was cancelled. Please contact the property if you need help.",
    },
    declined: {
      title: "Reservation Declined",
      message: "This reservation request was not accepted. Please contact the property if you need help.",
    },
    expired: {
      title: "Reservation Expired",
      message: "This reservation is no longer active. Please contact the property to make a new booking.",
    },
  }[reservation?.status as "cancelled" | "declined" | "expired"];

  if (terminalState) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center shadow-xl">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-2">{terminalState.title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{terminalState.message}</p>
        </div>
      </div>
    );
  }

  if (!isPaid) {
    const stillProcessing = !loadFailed && reservation?.status === "accepted_awaiting_payment";
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center shadow-xl">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${stillProcessing ? "bg-amber-100 dark:bg-amber-950/30" : "bg-red-100 dark:bg-red-950/30"}`}>
            {stillProcessing ? (
              <Clock className={`w-10 h-10 text-amber-600 ${isVerifying ? "animate-pulse" : ""}`} />
            ) : (
              <AlertTriangle className="w-10 h-10 text-red-600" />
            )}
          </div>
          <h1 className="text-2xl font-black text-foreground mb-2">
            {stillProcessing ? "Confirming Payment" : "Payment Not Confirmed"}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {stillProcessing
              ? "Stripe confirmation is still being processed. Your booking is confirmed only after payment is verified."
              : "We could not verify a successful payment for this reservation. Please return to your payment link or contact the property."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Check Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-full max-w-md"
      >
        {/* Success animation */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
            className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-green-500/20"
          >
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h1 className="text-3xl font-black text-foreground mb-2">Booking Confirmed!</h1>
            <p className="text-muted-foreground">
              {business?.displayName ? `Welcome to ${business.displayName}!` : "Your reservation has been confirmed."}
            </p>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          {/* Reservation details */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="bg-muted/30 px-5 py-3 border-b border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Reservation Details</p>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {reservation?.servicePointLabel && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Bed className="w-4 h-4" /> {servicePointTerm.singular}</span>
                  <span className="font-bold text-foreground">{reservation.servicePointLabel}</span>
                </div>
              )}
              {reservation?.checkInDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-in</span>
                  <span className="font-bold text-foreground">{formatDate(reservation.checkInDate)}</span>
                </div>
              )}
              {reservation?.checkOutDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-out</span>
                  <span className="font-bold text-foreground">{formatDate(reservation.checkOutDate)}</span>
                </div>
              )}
              {reservation?.guestCount && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-4 h-4" /> Guests</span>
                  <span className="font-bold text-foreground">{reservation.guestCount}</span>
                </div>
              )}
              {pricing && (
                <HotelPricingBreakdown
                  pricing={pricing}
                  pricePerNight={reservation?.pricePerNight}
                  numberOfNights={reservation?.numberOfNights}
                  currency={currency}
                  totalLabel="Total Paid"
                />
              )}
            </div>
          </div>

          {/* Verification code */}
          {reservation?.verificationCode && (
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 mb-4 text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Your Check-in Code</p>
              <p className="text-4xl font-black text-primary tracking-[0.3em] mb-2">{reservation.verificationCode}</p>
              <p className="text-xs text-muted-foreground">Present this code when you arrive at the property</p>
            </div>
          )}

          {/* Email notice */}
          {reservation?.maskedEmail && (
            <div className="bg-muted/30 border border-border rounded-xl p-4 mb-6 text-center">
              <p className="text-sm text-muted-foreground">
                A confirmation has been sent to <strong className="text-foreground">{reservation.maskedEmail}</strong>
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/b/${business?.countryCode}/${business?.slug}/`)}
              className="w-full py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> Back to Home
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
