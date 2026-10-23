export type CheckoutPricingBusiness = {
  taxRate?: number
  platformFeeMode?: "business_absorbs" | "customer_pays" | "split"
  passPlatformFeeToCustomer?: boolean
  customerPlatformFeePercent?: number
  platformFeeRate?: number
}

export function calculateCheckoutEstimate({
  subtotal,
  business,
  tipAmount = 0,
}: {
  subtotal: number
  business?: CheckoutPricingBusiness | null
  tipAmount?: number
}) {
  const tax = subtotal * ((business?.taxRate || 0) / 100)
  const platformFeeMode =
    business?.platformFeeMode ||
    (business?.passPlatformFeeToCustomer
      ? "customer_pays"
      : "business_absorbs")
  const customerPlatformFeePercent =
    platformFeeMode === "split"
      ? business?.customerPlatformFeePercent || 0
      : platformFeeMode === "customer_pays"
        ? 100
        : 0

  let platformFee = 0
  if (customerPlatformFeePercent > 0) {
    const fullPlatformFeeFloat =
      subtotal * ((business?.platformFeeRate || 0) / 100)
    const fullPlatformFeeCents = Math.round(fullPlatformFeeFloat * 100)
    const customerPlatformFeeCents = Math.round(
      fullPlatformFeeCents * customerPlatformFeePercent / 100,
    )
    platformFee = customerPlatformFeeCents / 100
  }

  return {
    tax,
    platformFee,
    platformFeeMode,
    customerPlatformFeePercent,
    total: subtotal + tax + platformFee + tipAmount,
  }
}
