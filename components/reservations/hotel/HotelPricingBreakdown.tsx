"use client";

export interface CustomerPricingBreakdown {
  subtotal: number;
  taxRate: number;
  taxLabel: string;
  taxAmount: number;
  taxAmountCents: number;
  platformFeeLabel: string;
  customerPlatformFeeAmount: number;
  customerPlatformFeeCents: number;
  total: number;
  totalCents: number;
}

export function formatBookingCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(Number(amount || 0));
}

export default function HotelPricingBreakdown({
  pricing,
  pricePerNight,
  numberOfNights,
  currency,
  totalLabel = "Total",
}: {
  pricing: CustomerPricingBreakdown;
  pricePerNight?: number;
  numberOfNights?: number;
  currency: string;
  totalLabel?: string;
}) {
  const accommodationLabel =
    pricePerNight && numberOfNights
      ? `${formatBookingCurrency(pricePerNight, currency)} × ${numberOfNights} night${numberOfNights === 1 ? "" : "s"}`
      : "Accommodation";

  return (
    <div className="border-t border-border pt-3 mt-3 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <span className="text-muted-foreground">{accommodationLabel}</span>
        <span className="font-bold text-foreground">
          {formatBookingCurrency(pricing.subtotal, currency)}
        </span>
      </div>
      {pricing.taxAmountCents > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">
            {pricing.taxLabel || "Tax"} ({pricing.taxRate}%)
          </span>
          <span className="font-bold text-foreground">
            {formatBookingCurrency(pricing.taxAmount, currency)}
          </span>
        </div>
      )}
      {pricing.customerPlatformFeeCents > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">
            {pricing.platformFeeLabel || "Platform Fee"}
          </span>
          <span className="font-bold text-foreground">
            {formatBookingCurrency(pricing.customerPlatformFeeAmount, currency)}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
        <span className="font-black text-foreground">{totalLabel}</span>
        <span className="text-xl font-black text-green-600">
          {formatBookingCurrency(pricing.total, currency)}
        </span>
      </div>
    </div>
  );
}
