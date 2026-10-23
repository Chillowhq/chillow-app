"use client"

import { Loader2 } from "lucide-react"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { BusinessProvider } from "@/contexts/BusinessContext"
import { AuthProvider } from "@/contexts/AuthContext"

/**
 * KitchenLayout — protects the /kitchen route group.
 * Auth is verified via GET /auth/me (Redis-backed session).
 * No localStorage involved.
 */
function KitchenLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuthGuard({ requiredRole: "kitchen" })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <BusinessProvider 
      businessType={user?.businessType} 
      modules={user?.modules} 
      capabilities={user?.capabilities}
      currency={user?.currency}
      taxRate={user?.taxRate}
      timezone={user?.timezone}
    >
      <div className="min-h-screen bg-background">
        <main className="w-full h-full">
          {children}
        </main>
      </div>
    </BusinessProvider>
  )
}

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <KitchenLayoutInner>{children}</KitchenLayoutInner>
    </AuthProvider>
  )
}
