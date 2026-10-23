"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAnalyticsReturnRefresh } from "@/hooks/use-analytics-return-refresh"
import apiClient from "@/lib/axios-config"
import type {
  CrmAnalyticsCustomRange,
  CrmAnalyticsData,
  CrmAnalyticsRange,
} from "@/types/crm-analytics"

type UseCrmAnalyticsOptions = {
  businessId?: string
  range: CrmAnalyticsRange
  customRange: CrmAnalyticsCustomRange
  active?: boolean
}

export function useCrmAnalytics({
  businessId,
  range,
  customRange,
  active = true,
}: UseCrmAnalyticsOptions) {
  const [data, setData] = useState<CrmAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)
  const inFlightKeyRef = useRef<string | null>(null)
  const hasDataRef = useRef(false)
  const loadedKeyRef = useRef<string | null>(null)
  const requestKey = [
    businessId || "",
    range,
    range === "custom" ? customRange.from : "",
    range === "custom" ? customRange.to : "",
  ].join(":")
  const canFetch = Boolean(
    active &&
    businessId &&
    (range !== "custom" || (customRange.from && customRange.to)),
  )

  useEffect(() => {
    hasDataRef.current = data !== null
  }, [data])

  const fetchAnalytics = useCallback(async () => {
    if (!canFetch) {
      abortRef.current?.abort()
      abortRef.current = null
      inFlightKeyRef.current = null
      requestSequenceRef.current += 1
      setLoading(false)
      setRefreshing(false)
      return
    }
    if (inFlightKeyRef.current === requestKey) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    inFlightKeyRef.current = requestKey
    const requestSequence = ++requestSequenceRef.current

    if (hasDataRef.current) setRefreshing(true)
    else setLoading(true)
    setError(null)

    const queryParams = new URLSearchParams({ range })
    if (range === "custom") {
      queryParams.set("from", customRange.from)
      queryParams.set("to", customRange.to)
    }

    try {
      const response = await apiClient.get<CrmAnalyticsData>(
        `/owner/guests/analytics?${queryParams.toString()}`,
        { signal: controller.signal },
      )
      if (
        controller.signal.aborted ||
        requestSequence !== requestSequenceRef.current
      ) return
      if (response.data.contractVersion !== 1) {
        throw new Error("Unsupported CRM analytics contract")
      }
      setData(response.data)
      setLastUpdated(new Date())
      loadedKeyRef.current = requestKey
    } catch (requestError) {
      if (
        controller.signal.aborted ||
        requestSequence !== requestSequenceRef.current
      ) return
      console.error("[Failed to fetch CRM analytics]", requestError)
      setError("Failed to load CRM analytics. Please try again.")
    } finally {
      if (
        !controller.signal.aborted &&
        requestSequence === requestSequenceRef.current
      ) {
        abortRef.current = null
        inFlightKeyRef.current = null
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [canFetch, customRange.from, customRange.to, range, requestKey])

  useEffect(() => {
    if (!canFetch) {
      void fetchAnalytics()
      return
    }
    if (loadedKeyRef.current === requestKey) return
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
