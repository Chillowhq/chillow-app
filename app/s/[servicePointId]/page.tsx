"use client"

import { useSearchParams, useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import TableMenuView from "@/components/table-menu-view"
import { getBusinessId } from "@/lib/business-info"
import { MenuPageSkeleton } from "@/components/customer-loading-skeletons"

// Legacy Shim Page (In case old URL structures are bookmarked or navigated directly)
export default function LegacyTableMenuPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const servicePointId = params.servicePointId as string
  const urlToken = searchParams.get("st") || undefined

  const [businessId, setRestaurantId] = useState<string | null>(null)

  useEffect(() => {
    // If we land here with a token, immediately clean the URL via replace, 
    // but the actual Token state logic is handled safely inside TableMenuView.
    if (urlToken) {
      router.replace(`/s/${servicePointId}`)
    }

    // Try finding the restaurant ID from query params or local config bindings
    const rId = searchParams.get("businessId") || getBusinessId()
    setRestaurantId(rId)
  }, [router, searchParams, servicePointId, urlToken])

  if (!businessId) return <MenuPageSkeleton />

  return (
    <TableMenuView 
      businessId={businessId} 
      servicePointId={servicePointId} 
      sessionToken={urlToken} 
    />
  )
}
