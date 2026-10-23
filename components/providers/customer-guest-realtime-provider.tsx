"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useParams, usePathname } from "next/navigation"
import { useCustomerNotifications } from "@/hooks/use-customer-notifications"
import { useWaitstaffRequest } from "@/hooks/use-waitstaff-request"
import { getBusinessId } from "@/lib/business-info"
import { getSessionInstanceId } from "@/lib/guest-session"
import type { WaitstaffNotificationSource } from "@/lib/waitstaff-customer-notification-reconciliation"
import type { IncomingWaiterCall } from "@/lib/waitstaff-request-reconciliation"

type CustomerGuestRealtimeContextValue = {
  notifications: ReturnType<typeof useCustomerNotifications>
  waitstaff: ReturnType<typeof useWaitstaffRequest>
  refreshGuestVisit: () => void
}

const CustomerGuestRealtimeContext =
  createContext<CustomerGuestRealtimeContextValue | null>(null)

function getVisitRuntimeKey(servicePointId: string) {
  return JSON.stringify([
    getBusinessId(),
    servicePointId,
    getSessionInstanceId(servicePointId),
  ])
}

function isWaitstaffRequestRoute(pathname: string, servicePointId: string) {
  const routeBase = `/s/${servicePointId}`
  return (
    pathname === routeBase ||
    pathname === `${routeBase}/menu` ||
    pathname === `${routeBase}/waitstaff-request`
  )
}

function CustomerGuestRealtimeRuntime({
  children,
  servicePointId,
  refreshGuestVisit,
}: {
  children: ReactNode
  servicePointId: string
  refreshGuestVisit: () => void
}) {
  const pathname = usePathname()
  const businessId = getBusinessId()
  const notifications = useCustomerNotifications()
  const { ingestWaitstaffCalls } = notifications
  const [keepWaitstaffActive, setKeepWaitstaffActive] = useState(false)
  const onWaitstaffRoute = isWaitstaffRequestRoute(pathname, servicePointId)

  const handleCurrentVisitCalls = useCallback((
    calls: IncomingWaiterCall,
    source: WaitstaffNotificationSource,
  ) => {
    ingestWaitstaffCalls(calls, source)
  }, [ingestWaitstaffCalls])

  const waiterEnabled = Boolean(
    businessId &&
    notifications.isSessionValid &&
    (onWaitstaffRoute || keepWaitstaffActive),
  )
  const waitstaff = useWaitstaffRequest({
    businessId,
    servicePointId,
    enabled: waiterEnabled,
    onCurrentVisitCalls: handleCurrentVisitCalls,
  })

  useEffect(() => {
    const hasActiveRequest = ["pending", "acknowledged"].includes(
      waitstaff.status || "",
    )

    if (hasActiveRequest) {
      setKeepWaitstaffActive(true)
    } else if (!onWaitstaffRoute) {
      setKeepWaitstaffActive(false)
    }
  }, [onWaitstaffRoute, waitstaff.status])

  const value = useMemo<CustomerGuestRealtimeContextValue>(() => ({
    notifications,
    waitstaff,
    refreshGuestVisit,
  }), [notifications, refreshGuestVisit, waitstaff])

  return (
    <CustomerGuestRealtimeContext.Provider value={value}>
      {children}
    </CustomerGuestRealtimeContext.Provider>
  )
}

export function CustomerGuestRealtimeProvider({ children }: { children: ReactNode }) {
  const params = useParams()
  const servicePointId = String(params.servicePointId || "")
  const [runtimeKey, setRuntimeKey] = useState(() => (
    getVisitRuntimeKey(servicePointId)
  ))

  const refreshGuestVisit = useCallback(() => {
    const nextRuntimeKey = getVisitRuntimeKey(servicePointId)
    setRuntimeKey((currentRuntimeKey) => (
      currentRuntimeKey === nextRuntimeKey
        ? currentRuntimeKey
        : nextRuntimeKey
    ))
  }, [servicePointId])

  useEffect(() => {
    refreshGuestVisit()
  }, [refreshGuestVisit])

  return (
    <CustomerGuestRealtimeRuntime
      key={runtimeKey}
      servicePointId={servicePointId}
      refreshGuestVisit={refreshGuestVisit}
    >
      {children}
    </CustomerGuestRealtimeRuntime>
  )
}

export function useCustomerGuestRealtime() {
  const context = useContext(CustomerGuestRealtimeContext)
  if (!context) {
    throw new Error(
      "useCustomerGuestRealtime must be used within CustomerGuestRealtimeProvider",
    )
  }
  return context
}
