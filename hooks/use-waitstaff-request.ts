"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import apiClient from "@/lib/axios-config"
import {
  ensureSessionId,
  getTableToken,
  isTableSessionValid,
} from "@/lib/guest-session"
import {
  getWaiterRequestTimerDeadline,
  getWaiterRequestTimerStart,
  isServiceRequestForContext,
  reconcileIncomingCall,
  type IncomingWaiterCall,
  type ServiceRequest,
} from "@/lib/waitstaff-request-reconciliation"
import type { WaitstaffRequestReasonId } from "@/lib/waitstaff-request-reasons"
import type { WaitstaffNotificationSource } from "@/lib/waitstaff-customer-notification-reconciliation"
import { useEventSource } from "@/hooks/use-event-source"

type UseWaitstaffRequestOptions = {
  businessId: string
  servicePointId: string
  enabled?: boolean
  onCurrentVisitCalls?: (
    calls: IncomingWaiterCall,
    source: WaitstaffNotificationSource,
  ) => void
}

type WaitstaffCallsResponse = {
  calls: ServiceRequest[]
  currentVisitCalls: ServiceRequest[]
}

export function useWaitstaffRequest({
  businessId,
  servicePointId,
  enabled = true,
  onCurrentVisitCalls,
}: UseWaitstaffRequestOptions) {
  const [currentRequest, setCurrentRequest] = useState<ServiceRequest | null>(null)
  const [isRecovering, setIsRecovering] = useState(enabled)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryError, setRecoveryError] = useState(false)
  const [expiredSession, setExpiredSession] = useState(false)
  const [countdown, setCountdown] = useState("")
  const [countdownProgress, setCountdownProgress] = useState<number | null>(null)

  const currentRequestRef = useRef<ServiceRequest | null>(null)
  const requestInFlightRef = useRef(false)
  const refreshGenerationRef = useRef(0)
  const initialRecoveryCompleteRef = useRef(false)
  const expiryRefreshDeadlineRef = useRef("")
  const mountedRef = useRef(false)
  const onCurrentVisitCallsRef = useRef(onCurrentVisitCalls)

  const requestContext = useMemo(
    () => ({ businessId, servicePointId }),
    [businessId, servicePointId],
  )

  useEffect(() => {
    onCurrentVisitCallsRef.current = onCurrentVisitCalls
  }, [onCurrentVisitCalls])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      refreshGenerationRef.current += 1
      requestInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    refreshGenerationRef.current += 1
    requestInFlightRef.current = false
    currentRequestRef.current = null
    setCurrentRequest(null)
    setError(null)
    setRecoveryError(false)
    setExpiredSession(false)
    setCountdown("")
    setCountdownProgress(null)
    setIsSubmitting(false)
    setIsRecovering(enabled)
    initialRecoveryCompleteRef.current = false
    expiryRefreshDeadlineRef.current = ""
  }, [businessId, enabled, servicePointId])

  const updateSessionValidity = useCallback(() => {
    if (!enabled) {
      if (mountedRef.current) setExpiredSession(false)
      return false
    }

    const isValid = Boolean(servicePointId && isTableSessionValid(servicePointId))
    if (mountedRef.current) setExpiredSession(!isValid)
    return isValid
  }, [enabled, servicePointId])

  const applyIncomingRequest = useCallback(
    (incoming: IncomingWaiterCall) => {
      if (!mountedRef.current) return

      const reconciledRequest = reconcileIncomingCall(
        currentRequestRef.current,
        incoming,
        requestContext,
      )
      currentRequestRef.current = reconciledRequest
      setCurrentRequest(reconciledRequest)
    },
    [requestContext],
  )

  const reportCurrentVisitCalls = useCallback((
    calls: IncomingWaiterCall,
    source: WaitstaffNotificationSource,
  ) => {
    onCurrentVisitCallsRef.current?.(calls, source)
  }, [])

  const fetchRequests = useCallback(async (): Promise<WaitstaffCallsResponse> => {
    if (!businessId || !servicePointId) {
      return { calls: [], currentVisitCalls: [] }
    }

    const token = getTableToken(servicePointId)
    const sessionId = ensureSessionId()
    if (!token || !sessionId) {
      return { calls: [], currentVisitCalls: [] }
    }

    const response = await apiClient.get("/waitstaff/calls", {
      params: {
        status: "all",
        businessId,
        servicePointId,
        token,
        sessionId,
      },
    })
    return {
      calls: Array.isArray(response.data?.calls)
        ? response.data.calls as ServiceRequest[]
        : [],
      currentVisitCalls: Array.isArray(response.data?.currentVisitCalls)
        ? response.data.currentVisitCalls as ServiceRequest[]
        : [],
    }
  }, [businessId, servicePointId])

  const refresh = useCallback(async () => {
    if (!enabled || !businessId || !servicePointId) {
      if (mountedRef.current) setIsRecovering(false)
      return
    }

    if (!updateSessionValidity()) {
      if (mountedRef.current) setIsRecovering(false)
      return
    }

    const generation = ++refreshGenerationRef.current
    const isInitialRecovery = !initialRecoveryCompleteRef.current
    if (isInitialRecovery && mountedRef.current) setIsRecovering(true)

    try {
      const response = await fetchRequests()
      if (!mountedRef.current || generation !== refreshGenerationRef.current) return
      applyIncomingRequest(response.calls)
      reportCurrentVisitCalls(response.currentVisitCalls, "recovery")
      setRecoveryError(false)
    } catch {
      if (!mountedRef.current || generation !== refreshGenerationRef.current) return
      console.error("[waitstaff-request] active request refresh failed")
      if (!currentRequestRef.current) setRecoveryError(true)
    } finally {
      if (mountedRef.current && generation === refreshGenerationRef.current) {
        initialRecoveryCompleteRef.current = true
        setIsRecovering(false)
      }
    }
  }, [
    applyIncomingRequest,
    businessId,
    enabled,
    fetchRequests,
    reportCurrentVisitCalls,
    servicePointId,
    updateSessionValidity,
  ])

  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])

  const timerDeadline = getWaiterRequestTimerDeadline(currentRequest)
  const timerStart = getWaiterRequestTimerStart(currentRequest)
  const timerRequestId = currentRequest?._id || ""

  useEffect(() => {
    if (!enabled || !timerRequestId || !timerDeadline) {
      expiryRefreshDeadlineRef.current = ""
      setCountdown("")
      setCountdownProgress(null)
      return
    }

    const expiresAt = new Date(timerDeadline).getTime()
    if (!Number.isFinite(expiresAt)) {
      setCountdown("")
      setCountdownProgress(null)
      return
    }

    const startsAt = timerStart ? new Date(timerStart).getTime() : Number.NaN
    const duration = expiresAt - startsAt

    let interval: number | undefined
    const updateCountdown = () => {
      const remaining = expiresAt - Date.now()
      if (remaining <= 0) {
        setCountdown("")
        setCountdownProgress(null)
        if (expiryRefreshDeadlineRef.current !== timerDeadline) {
          expiryRefreshDeadlineRef.current = timerDeadline
          void refresh()
        }
        if (interval) window.clearInterval(interval)
        return false
      }

      const remainingSeconds = Math.ceil(remaining / 1000)
      const minutes = Math.floor(remainingSeconds / 60)
      const seconds = remainingSeconds % 60
      setCountdown(
        `${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`,
      )
      setCountdownProgress(
        Number.isFinite(startsAt) && duration > 0
          ? Math.min(1, Math.max(0, remaining / duration))
          : null,
      )
      return true
    }

    if (updateCountdown()) interval = window.setInterval(updateCountdown, 1_000)
    return () => {
      if (interval) window.clearInterval(interval)
    }
  }, [enabled, refresh, timerDeadline, timerRequestId, timerStart])

  const token = getTableToken(servicePointId)
  const deviceSessionId = ensureSessionId()
  const sessionIsValid = Boolean(
    enabled && servicePointId && token && isTableSessionValid(servicePointId),
  )
  const sseUrl =
    businessId && deviceSessionId && sessionIsValid && token
      ? `/events?role=table&businessId=${encodeURIComponent(businessId)}&token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(deviceSessionId)}`
      : ""

  useEventSource(
    sseUrl,
    {
      waiter_call_created: (data: { call?: ServiceRequest }) => {
        if (!data?.call) return
        applyIncomingRequest(data.call)
        reportCurrentVisitCalls(data.call, "sse")
      },
      waiter_call_updated: (data: { call?: ServiceRequest }) => {
        if (!data?.call) return
        applyIncomingRequest(data.call)
        reportCurrentVisitCalls(data.call, "sse")
      },
    },
    { onReconnect: refresh },
  )

  const submitRequest = useCallback(
    async (
      reason: WaitstaffRequestReasonId,
      servicePointLabel: string,
    ) => {
      if (!enabled || requestInFlightRef.current) return null

      const confirmedRequest = currentRequestRef.current
      if (
        confirmedRequest &&
        ["pending", "acknowledged"].includes(confirmedRequest.status)
      ) {
        return confirmedRequest
      }

      if (!servicePointId || !servicePointLabel) {
        setError(
          "Service point is missing. Please open this from your QR code or menu.",
        )
        return null
      }

      const currentToken = getTableToken(servicePointId)
      const currentSessionId = ensureSessionId()
      if (!businessId || !currentToken || !currentSessionId) {
        setExpiredSession(true)
        setError("Your session has expired. Please rescan the QR code.")
        return null
      }

      requestInFlightRef.current = true
      refreshGenerationRef.current += 1
      setError(null)
      setRecoveryError(false)
      setIsSubmitting(true)

      try {
        const response = await apiClient.post("/waitstaff/calls", {
          servicePointId,
          servicePointLabel,
          reason,
          note: "",
          businessId,
          token: currentToken,
          sessionId: currentSessionId,
        })
        const call = response.data?.call as ServiceRequest | undefined
        if (!call || !isServiceRequestForContext(call, requestContext)) {
          throw new Error("Invalid waitstaff-request response scope")
        }

        applyIncomingRequest(call)
        if (mountedRef.current) setError(null)
        return call
      } catch {
        const activeRequest = currentRequestRef.current
        const hasConfirmedActiveRequest =
          activeRequest &&
          isServiceRequestForContext(activeRequest, requestContext) &&
          ["pending", "acknowledged"].includes(activeRequest.status)

        if (!hasConfirmedActiveRequest && mountedRef.current) {
          console.error("[waitstaff-request] waiter request failed")
          setError("Failed to notify waitstaff. Please try again.")
        }
        return null
      } finally {
        requestInFlightRef.current = false
        if (mountedRef.current) setIsSubmitting(false)
      }
    },
    [
      applyIncomingRequest,
      businessId,
      enabled,
      requestContext,
      servicePointId,
    ],
  )

  return {
    currentRequest,
    status: currentRequest?.status || null,
    countdown,
    countdownProgress,
    isRecovering,
    isSubmitting,
    error,
    recoveryError,
    expiredSession,
    submitRequest,
    refresh,
  }
}
