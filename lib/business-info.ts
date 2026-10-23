/**
 * Returns the businessId for the current customer QR session.
 *
 * Source priority:
 *  1. sessionStorage "qs_business_id" — set by the QR entry route (table-menu-view)
 *  2. NEXT_PUBLIC_BUSINESS_ID env var — useful for development / single-tenant deploys
 *
 * ⚠️  This is intentionally read from sessionStorage (tab-scoped) NOT localStorage.
 *     The businessId belongs to the customer's current QR scan session, not to any
 *     staff member. The old qs_staff_session localStorage read has been removed.
 */
export function getBusinessId(): string {
  if (typeof window !== "undefined") {
    const id = sessionStorage.getItem("qs_business_id")
    if (id) return id
  }

  if (process.env.NEXT_PUBLIC_BUSINESS_ID) {
    return process.env.NEXT_PUBLIC_BUSINESS_ID
  }

  return ""
}
