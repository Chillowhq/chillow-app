"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { apiClient, SESSION_REVOKED_EVENT } from "@/lib/axios-config"
import { toast } from "sonner"
import { useEventSource } from "@/hooks/use-event-source"
import type { BusinessCapabilities, BusinessModule } from "@/types/business-capabilities"

export interface DashboardUser {
  userId?: string
  staffId?: string
  email: string
  role: string // "owner" | "co_owner" | "manager" | operational staff roles
  permissions?: string[]
  coOwnerRestrictions?: string[]
  managementAccessAreas?: string[]
  businessId: string
  name?: string
  displayName?: string
  businessType?: string
  modules?: BusinessModule[]
  capabilities?: BusinessCapabilities
  currency?: string
  taxRate?: number
  timezone?: string
  entitlements?: {
    crm: boolean
    advancedAnalytics: boolean
    advancedBranding: boolean
    aiBusinessAnalyst: boolean
  }
}

interface AuthContextType {
  user: DashboardUser | null
  loading: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<DashboardUser | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

import { useStaffHeartbeat } from "@/hooks/use-staff-heartbeat"

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [loading, setLoading] = useState(true)
  const accessRefreshTimerRef = useRef<number | null>(null)
  const accessRefreshInFlightRef = useRef<Promise<DashboardUser | null> | null>(null)

  useStaffHeartbeat(user)

  const fetchCurrentUser = useCallback(async ({
    showLoading = false,
    preserveOnTransientError = false,
  }: {
    showLoading?: boolean
    preserveOnTransientError?: boolean
  } = {}) => {
    try {
      if (showLoading) setLoading(true)
      const res = await apiClient.get<DashboardUser>("/auth/me")
      setUser(res.data)
      return res.data
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (!preserveOnTransientError || status === 401) setUser(null)
      return null
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  const checkAuth = useCallback(
    () => fetchCurrentUser({ showLoading: true }),
    [fetchCurrentUser],
  )

  const refreshUser = useCallback(
    () => fetchCurrentUser({ preserveOnTransientError: true }),
    [fetchCurrentUser],
  )

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    const handleSessionRevoked = () => {
      setUser(null)
      router.replace("/login")
    }
    window.addEventListener(SESSION_REVOKED_EVENT, handleSessionRevoked)
    return () => window.removeEventListener(SESSION_REVOKED_EVENT, handleSessionRevoked)
  }, [router])

  const refreshCoOwnerAccess = useCallback(() => {
    if (accessRefreshInFlightRef.current) return

    const request = refreshUser()
    accessRefreshInFlightRef.current = request
    void request.finally(() => {
      if (accessRefreshInFlightRef.current === request) {
        accessRefreshInFlightRef.current = null
      }
    })
  }, [refreshUser])

  const scheduleCoOwnerAccessRefresh = useCallback(() => {
    if (accessRefreshTimerRef.current !== null) {
      window.clearTimeout(accessRefreshTimerRef.current)
    }
    accessRefreshTimerRef.current = window.setTimeout(() => {
      accessRefreshTimerRef.current = null
      refreshCoOwnerAccess()
    }, 150)
  }, [refreshCoOwnerAccess])

  const coOwnerAccessHandlers = useMemo(() => ({
    co_owner_access_changed: scheduleCoOwnerAccessRefresh,
  }), [scheduleCoOwnerAccessRefresh])

  useEventSource(
    user?.role === "co_owner" ? "/auth/access-events" : "",
    coOwnerAccessHandlers,
    {
      onOpen: refreshCoOwnerAccess,
      onReconnect: refreshCoOwnerAccess,
      // This channel replaces focus-based auth refreshes. A real SSE open or
      // access-change event is the only trigger after initial authentication.
      recoverOnVisibility: false,
    },
  )

  useEffect(() => () => {
    if (accessRefreshTimerRef.current !== null) {
      window.clearTimeout(accessRefreshTimerRef.current)
    }
  }, [])

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout")
    } catch (err) {
      console.error("Logout error:", err)
    }
    setUser(null)
    toast.success("Successfully logged out")
    router.replace("/login")
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider")
  }
  return context
}
