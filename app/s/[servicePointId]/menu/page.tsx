"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import TableMenuView from "@/components/table-menu-view"
import { getStoredBusinessId, saveBusinessId } from "@/lib/guest-session"
import { MenuPageSkeleton } from "@/components/customer-loading-skeletons"

/**
 * Stable Customer Menu Route — /s/:servicePointId/menu
 *
 * This is the permanent home for the customer app after a QR scan.
 *
 * Behaviour:
 *  - Reads businessId from the ?businessId= query param (set by the QR bootstrap redirect)
 *    or falls back to sessionStorage (survives soft navigations within the tab)
 *  - Never calls /table-session/start — only the /q route does that
 *  - Refreshing this page is safe: it reuses the existing session token from sessionStorage
 */
function MenuContent() {
  const params = useParams()
  const searchParams = useSearchParams()

  const servicePointId = params.servicePointId as string
  const businessIdFromUrl = searchParams.get("businessId")

  const [businessId, setBusinessId] = useState<string | null>(null)

  useEffect(() => {
    // Prefer URL param (freshly set by QR redirect), fallback to sessionStorage
    const id = businessIdFromUrl || getStoredBusinessId()
    if (id) {
      saveBusinessId(id) // keep sessionStorage in sync for child pages (/order, /status etc.)
      setBusinessId(id)
    }
  }, [businessIdFromUrl])

  if (!businessId) return <MenuPageSkeleton />

  return (
    <TableMenuView
      businessId={businessId}
      servicePointId={servicePointId}
      // No sessionToken prop — TableMenuView reads the stored token via
      // getTableToken(servicePointId). This guarantees no new session is ever
      // created by this route.
    />
  )
}

export default function StableMenuPage() {
  return (
    <Suspense fallback={<MenuPageSkeleton />}>
      <MenuContent />
    </Suspense>
  )
}
