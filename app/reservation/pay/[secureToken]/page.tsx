"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2, CalendarDays, Users, Bed, CreditCard, Shield,
  AlertTriangle, CheckCircle2, Clock
} from "lucide-react";
import apiClient from "@/lib/axios-config";
import { ReservationDetailsSkeleton } from "@/components/customer-loading-skeletons";
import HotelPricingBreakdown, {
  formatBookingCurrency,
} from "@/components/reservations/hotel/HotelPricingBreakdown";
import {
  formatLongReservationDate as formatDate,
  getReservationNights as nightsBetween,
} from "@/lib/reservation-date";
import { getServicePointTerm } from "@/contexts/BusinessContext";

const servicePointTerm = getServicePointTerm();

function TimeRemaining({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    let expired = false;
    const update = () => {
      if (expired) return;
      const parsed = Date.parse(expiresAt);
      if (!Number.isFinite(parsed)) {
        setRemaining("00:00");
        expired = true;
        onExpire();
        return;
      }
      
      const diff = parsed - Date.now();
      if (diff <= 0) {
        setRemaining("00:00");
        expired = true;
        onExpire();
        return;
      }
      
      const totalSeconds = Math.floor(diff / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      setRemaining(`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return <span>{remaining}</span>;
}

export default function ReservationPayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const secureToken = params.secureToken as string;

  const [reservation, setReservation] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExpiredLocal, setHasExpiredLocal] = useState(false);
  const checkoutStartedRef = useRef(false);
  const wasCancelled = searchParams.get("payment") === "cancelled";

  useEffect(() => {
    if (!secureToken) return;
    const fetchReservation = async () => {
      try {
        const res = await apiClient.get(`/public/reservations/by-token/${secureToken}`);
        setReservation(res.data.reservation);
        setBusiness(res.data.business);
      } catch (err: any) {
        setError(err.response?.data?.error || "This payment link is invalid or has expired.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchReservation();
  }, [secureToken]);

  const handlePay = async () => {
    if (checkoutStartedRef.current) return;
    checkoutStartedRef.current = true;
    setIsCheckingOut(true);
    setError(null);
    try {
      const res = await apiClient.post("/payments/checkout-reservation", { secureToken });
      if (res.data?.sessionUrl) {
        window.location.href = res.data.sessionUrl;
      } else {
        setError("Failed to create checkout session. Please try again.");
        setIsCheckingOut(false);
        checkoutStartedRef.current = false;
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Payment could not be initiated. Please try again.");
      setIsCheckingOut(false);
      checkoutStartedRef.current = false;
    }
  };

  if (isLoading) {
    return <ReservationDetailsSkeleton />;
  }

  if (error && !reservation) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-xl"
        >
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-black text-foreground mb-2">Link Unavailable</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  const isPending = reservation?.status === "accepted_awaiting_payment";
  const isAlreadyPaid = reservation?.paymentStatus === "paid" || reservation?.status === "confirmed";
  const isCancelled = reservation?.status === "cancelled";
  
  // If pending but missing expiration, or date is in the past, consider it expired.
  const isExpiredByDate = isPending && (!reservation?.paymentExpiresAt || new Date(reservation.paymentExpiresAt).getTime() <= Date.now());
  const isExpired = reservation?.status === "expired" || hasExpiredLocal || isExpiredByDate;

  const nights = reservation?.numberOfNights || nightsBetween(reservation?.checkInDate, reservation?.checkOutDate);
  const pricing = reservation?.pricing;
  // Do NOT default to 0 — a missing amount must be treated as an error, not displayed as EUR 0.
  const totalPrice = pricing?.total ?? reservation?.totalPrice;
  const hasValidAmount = typeof totalPrice === "number" && Number.isFinite(totalPrice) && totalPrice > 0;
  const currency = (reservation?.currency || business?.currency || "eur").toUpperCase();

  // ── Status screens ────────────────────────────────────────────────────────

  if (isAlreadyPaid) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-xl"
        >
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
            Your reservation at <strong className="text-foreground">{business?.displayName}</strong> has been paid and confirmed.
          </p>
          <div className="bg-muted/30 rounded-xl p-4 text-sm text-left space-y-2 border border-border mb-6">
            <div className="flex justify-between"><span className="text-muted-foreground">{servicePointTerm.singular}</span><span className="font-bold">{reservation?.servicePointLabel}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Check-in</span><span className="font-bold">{formatDate(reservation?.checkInDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Check-out</span><span className="font-bold">{formatDate(reservation?.checkOutDate)}</span></div>
            {pricing && (
              <HotelPricingBreakdown
                pricing={pricing}
                pricePerNight={reservation?.pricePerNight}
                numberOfNights={nights}
                currency={currency}
                totalLabel="Total Paid"
              />
            )}
          </div>
          {reservation?.verificationCode && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Your Check-in Code</p>
              <p className="text-3xl font-black text-primary tracking-widest">{reservation.verificationCode}</p>
              <p className="text-xs text-muted-foreground mt-1">Present this at the property</p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-xl"
        >
          <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-xl font-black text-foreground mb-2">Payment Link Expired</h1>
          <p className="text-muted-foreground text-sm">This payment link has expired. Your reservation was not confirmed. Please contact the property to request a new link.</p>
        </motion.div>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-xl"
        >
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-black text-foreground mb-2">Reservation Cancelled</h1>
          <p className="text-muted-foreground text-sm">This reservation was cancelled. Please contact the property for more information.</p>
        </motion.div>
      </div>
    );
  }

  // ── Main payment screen ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-6">
          {business?.logoUrl && (
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-border shadow-md mx-auto mb-3">
              <img src={business.logoUrl} alt={business?.displayName} className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="text-2xl font-black text-foreground">{business?.displayName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete your reservation payment</p>
        </div>

        {/* Cancelled payment alert */}
        {wasCancelled && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">Payment was cancelled. You can try again below.</p>
          </div>
        )}

        {/* Reservation summary card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="bg-muted/30 px-5 py-3 border-b border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Your Reservation</p>
          </div>
          <div className="p-5 space-y-3 text-sm">
            {reservation?.servicePointLabel && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Bed className="w-4 h-4" /> {servicePointTerm.singular}</span>
                <span className="font-bold text-foreground">{reservation.servicePointLabel}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-in</span>
              <span className="font-bold text-foreground">{formatDate(reservation?.checkInDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-out</span>
              <span className="font-bold text-foreground">{formatDate(reservation?.checkOutDate)}</span>
            </div>
            {reservation?.guestCount && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-4 h-4" /> Guests</span>
                <span className="font-bold text-foreground">{reservation.guestCount}</span>
              </div>
            )}
            {pricing && hasValidAmount ? (
              <HotelPricingBreakdown
                pricing={pricing}
                pricePerNight={reservation?.pricePerNight}
                numberOfNights={nights}
                currency={currency}
              />
            ) : (
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-xl font-black text-red-500">—</span>
              </div>
            )}
            {!hasValidAmount && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
                Payment amount unavailable. Please contact the property.
              </div>
            )}
          </div>
        </div>

        {/* Timer */}
        {reservation?.paymentExpiresAt && isPending && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-200">Payment link expires in</p>
              <p className="text-sm font-black text-amber-700 dark:text-amber-300 font-mono">
                <TimeRemaining expiresAt={reservation.paymentExpiresAt} onExpire={() => setHasExpiredLocal(true)} />
              </p>
            </div>
          </div>
        )}

        {/* Security note */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 px-1">
          <Shield className="w-3.5 h-3.5 shrink-0 text-green-500" />
          <span>Secure payment powered by <strong>Stripe</strong>. Your card data never touches our servers.</span>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={isCheckingOut || !isPending || !hasValidAmount}
          className="w-full py-4 rounded-2xl font-black text-base bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
        >
          {isCheckingOut ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to payment...</>
          ) : hasValidAmount ? (
            <><CreditCard className="w-5 h-5" /> Pay {formatBookingCurrency(totalPrice, currency)}</>
          ) : (
            <><AlertTriangle className="w-5 h-5" /> Invalid payment amount</>
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By paying you agree to the property's terms. Full refund policy applies per the property's cancellation policy.
        </p>
      </motion.div>
    </div>
  );
}
