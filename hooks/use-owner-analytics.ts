"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAnalyticsReturnRefresh } from "@/hooks/use-analytics-return-refresh"
import apiClient from "@/lib/axios-config"
import type {
  OwnerAnalyticsCustomRange,
  OwnerAnalyticsData,
  OwnerAnalyticsRange,
} from "@/types/owner-analytics"

type UseOwnerAnalyticsOptions = {
  businessId?: string
  range: OwnerAnalyticsRange
  customRange: OwnerAnalyticsCustomRange
}

export function useOwnerAnalytics({
  businessId,
  range,
  customRange,
}: UseOwnerAnalyticsOptions) {
  const [data, setData] = useState<OwnerAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const analyticsAbortRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)
  const inFlightKeyRef = useRef<string | null>(null)
  const loadedKeyRef = useRef<string | null>(null)
  const hasDataRef = useRef(false)
  const requestKey = [
    businessId || "",
    range,
    range === "custom" ? customRange.from : "",
    range === "custom" ? customRange.to : "",
  ].join(":")
  const canFetch = Boolean(
    businessId &&
    (range !== "custom" || (customRange.from && customRange.to)),
  )

  useEffect(() => {
    hasDataRef.current = data !== null
  }, [data])

  const fetchAnalytics = useCallback(async () => {
    if (!canFetch) {
      analyticsAbortRef.current?.abort()
      analyticsAbortRef.current = null
      inFlightKeyRef.current = null
      requestSequenceRef.current += 1
      setLoading(false)
      setRefreshing(false)
      return
    }
    if (inFlightKeyRef.current === requestKey) return

    analyticsAbortRef.current?.abort()
    const controller = new AbortController()
    analyticsAbortRef.current = controller
    inFlightKeyRef.current = requestKey
    const requestSequence = ++requestSequenceRef.current

    if (hasDataRef.current) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    const queryParams = new URLSearchParams({
      range,
    })
    if (range === "custom") {
      queryParams.set("from", customRange.from)
      queryParams.set("to", customRange.to)
    }

    try {
      const response = await apiClient.get<OwnerAnalyticsData>(
        `/owner/analytics?${queryParams.toString()}`,
        { signal: controller.signal },
      )
      if (
        controller.signal.aborted ||
        requestSequence !== requestSequenceRef.current
      ) {
        return
      }

      if (response.data.contractVersion !== 2) {
        throw new Error("Unsupported owner analytics contract")
      }

      setData(response.data)
      setLastUpdated(new Date())
      loadedKeyRef.current = requestKey
    } catch (requestError) {
      if (
        controller.signal.aborted ||
        requestSequence !== requestSequenceRef.current
      ) {
        return
      }
      console.error("[Failed to fetch owner analytics]", requestError)
      setError("Failed to load analytics. Please try again.")
    } finally {
      if (
        !controller.signal.aborted &&
        requestSequence === requestSequenceRef.current
      ) {
        analyticsAbortRef.current = null
        inFlightKeyRef.current = null
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [
    customRange.from,
    customRange.to,
    canFetch,
    range,
    requestKey,
  ])

  useEffect(() => {
    if (canFetch && loadedKeyRef.current === requestKey) return
    const initialFetchTimer = window.setTimeout(() => {
      void fetchAnalytics()
    }, 0)
    return () => window.clearTimeout(initialFetchTimer)
  }, [canFetch, fetchAnalytics, requestKey])

  useAnalyticsReturnRefresh({
    active: canFetch,
    onRefresh: fetchAnalytics,
  })

  return {
    data,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh: fetchAnalytics,
  }
}
