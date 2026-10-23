"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LegacyPropertyProfilePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/owner/settings?tab=property-profile")
  }, [router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      Opening Property Profile…
    </div>
  )
}
