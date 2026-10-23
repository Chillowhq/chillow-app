/**
 * Returns the canonical stable menu URL for the customer app.
 *
 * This is the ONLY place in the codebase that should construct this URL.
 * Use it everywhere a "Back to Menu" or "Explore Menu" navigation is needed.
 *
 * Rules:
 *  - /q/... is for QR scan bootstrap only (creates session once)
 *  - /s/:id/menu is the permanent customer home (reads existing session)
 *  - Never navigate to /q/... for normal customer navigation
 */
export function getTableMenuUrl(servicePointId: string, businessId: string): string {
  return `/s/${servicePointId}/menu?businessId=${encodeURIComponent(businessId)}`
}
