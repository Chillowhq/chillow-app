/**
 * HotelRoomPriceDisplay
 *
 * Purely presentational. Displays:
 *   1. The hotel's configured base room rate for example(€128.00 / night)
 *   2. The canonical stay total from the backend pricing engine (€136.45 total for 1 night)
 *   3. An "Includes taxes & fees" qualifier — only when additional charges exist
 *
 * This component does NOT perform any pricing calculations.
 * All values must come from the canonical pricingSummary returned by:
 *   - GET /public/reservations/available-rooms   (public flow)
 *   - GET /owner/reservations/availability       (staff flow)
 */
"use client";

import { formatBookingCurrency } from "./HotelPricingBreakdown";

/** The canonical pricing summary embedded in each room by the backend. */
export interface RoomPricingSummary {
  nights: number;
  subtotal: number;
  taxAmount: number;
  taxAmountCents: number;
  taxRate: number;
  customerPlatformFeeAmount: number;
  customerPlatformFeeCents: number;
  total: number;
  totalCents: number;
  /** True when taxAmountCents > 0 OR customerPlatformFeeCents > 0 */
  hasAdditionalCharges: boolean;
}

interface HotelRoomPriceDisplayProps {
  /** The hotel's configured base room rate (never overwritten with the total). */
  pricePerNight: number;
  /** The currency code, e.g. "EUR". */
  currency: string;
  /**
   * Canonical stay pricing from the backend.
   * When null/undefined (e.g. room has no price configured) only the base rate is shown.
   */
  pricingSummary?: RoomPricingSummary | null;
  /** Extra class names for the wrapper. */
  className?: string;
  /** Size variant — "sm" for compact room cards, "md" (default) for detail panels. */
  size?: "sm" | "md";
}

export function HotelRoomPriceDisplay({
  pricePerNight,
  currency,
  pricingSummary,
  className = "",
  size = "sm",
}: HotelRoomPriceDisplayProps) {
  const nights = pricingSummary?.nights ?? 1;
  const nightLabel = nights !== 1 ? `${nights} nights` : "1 night";

  if (size === "md") {
    return (
      <div className={`space-y-0.5 ${className}`}>
        {/* Base rate — prominent */}
        <p className="text-base font-black text-foreground">
          {formatBookingCurrency(pricePerNight, currency)}
          <span className="ml-1 text-xs font-semibold text-muted-foreground">/ night</span>
        </p>

        {/* Canonical total — secondary */}
        {pricingSummary && (
          <p className="text-sm font-bold text-primary">
            {formatBookingCurrency(pricingSummary.total, currency)} total for{" "}
            {nightLabel}
          </p>
        )}

        {/* Fee disclaimer — only when additional charges genuinely exist */}
        {pricingSummary?.hasAdditionalCharges && (
          <p className="text-[11px] font-medium text-muted-foreground">
            Includes taxes &amp; fees
          </p>
        )}
      </div>
    );
  }

  // size === "sm" — compact card layout
  return (
    <div className={`space-y-0.5 ${className}`}>
      {/* Base rate */}
      <p className="text-sm font-black text-foreground sm:text-base">
        {formatBookingCurrency(pricePerNight, currency)}
        <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">
          / night
        </span>
      </p>

      {/* Canonical stay total */}
      {pricingSummary && (
        <p className="text-xs font-bold text-primary">
          {formatBookingCurrency(pricingSummary.total, currency)} total for{" "}
          {nightLabel}
        </p>
      )}

      {/* Fee disclaimer */}
      {pricingSummary?.hasAdditionalCharges && (
        <p className="text-[10px] font-medium text-muted-foreground leading-tight">
          Includes taxes &amp; fees
        </p>
      )}
    </div>
  );
}
