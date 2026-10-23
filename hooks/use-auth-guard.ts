"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuthContext, type DashboardUser } from "@/contexts/AuthContext"
import {
  getFirstPermittedManagementPath,
  hasManagementArea,
  hasManagementPermission,
  type ManagementAccessArea,
} from "@/lib/manager-permissions"

// Re-export type for compatibility
export type { DashboardUser }

interface UseAuthGuardOptions {
  requiredRole?: string | string[]
  allowedRoles?: string[]
  requiredPermission?: string
  requiredArea?: ManagementAccessArea
}

/**
 * useAuthGuard
 *
 * Consumes AuthContext and enforces role-based redirection.
 */
export function useAuthGuard({ requiredRole, allowedRoles, requiredPermission, requiredArea }: UseAuthGuardOptions = {}) {
  const router = useRouter()
  const { user, loading, logout, refreshUser } = useAuthContext()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (loading) return

    setIsAuthorized(false)

    if (!user) {
      router.replace("/login")
      return
    }

    if (requiredRole || allowedRoles) {
      let allowed: string[] = []

      if (allowedRoles) {
        allowed = allowedRoles
      } else if (requiredRole === "owner") {
        allowed = ["owner", "co_owner"]
      } else if (requiredRole === "primary_owner") {
        allowed = ["owner"]
      } else {
        allowed = Array.isArray(requiredRole) ? requiredRole : (requiredRole ? [requiredRole] : [])
      }
      
      if (!allowed.includes(user.role)) {
        toast.error("Access denied. You don't have permission to view this page.")
        const isManagementUser = ["owner", "co_owner", "manager", "restaurant_owner", "admin"].includes(user.role)
        router.replace(isManagementUser ? getFirstPermittedManagementPath(user) : "/login")
        return
      }
    }

    if (requiredPermission && !hasManagementPermission(user, requiredPermission)) {
      toast.error("Access denied. You don't have permission to view this page.")
      router.replace(getFirstPermittedManagementPath(user))
      return
    }

    const isManagementUser = ["owner", "co_owner", "manager", "restaurant_owner", "admin"].includes(user.role)
    if (requiredArea && isManagementUser && !hasManagementArea(user, requiredArea)) {
      toast.error("Access denied. You don't have permission to view this page.")
      router.replace(getFirstPermittedManagementPath(user))
      return
    }

    setIsAuthorized(true)
  }, [user, loading, requiredRole, allowedRoles, requiredPermission, requiredArea, router])

  return { 
    user: isAuthorized ? user : null, 
    loading: loading || (!isAuthorized && user !== null), 
    logout, 
    refreshUser 
  }
}
