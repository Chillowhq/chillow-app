"use client"

import { useEffect, useRef } from "react"

const ANALYTICS_RETURN_STALE_MS = 30 * 1000
const ANALYTICS_RETURN_DEBOUNCE_MS = 300

type UseAnalyticsReturnRefreshOptions = {
  active?: boolean
  onRefresh: () => void | Promise<void>
}

/**
 * Refresh reporting data once after a meaningful period away from the view.
 * Visibility and focus can fire together, so they share one inactivity marker
 * and one trailing debounce instead of issuing duplicate requests.
 */
export function useAnalyticsReturnRefresh({
  active = true,
  onRefresh,
}: UseAnalyticsReturnRefreshOptions) {
  const refreshRef = useRef(onRefresh)
  const inactiveAtRef = useRef<number | null>(null)
  const refreshTimerRef = useRef<number | null>(null)

  useEffect(() => {
    refreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    const clearPendingRefresh = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }

    if (!active) {
      inactiveAtRef.current ??= Date.now()
      clearPendingRefresh()
      return
    }

    const markInactive = () => {
      inactiveAtRef.current ??= Date.now()
    }
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return
      const inactiveAt = inactiveAtRef.current
      if (inactiveAt === null) return

      inactiveAtRef.current = null
      if (Date.now() - inactiveAt < ANALYTICS_RETURN_STALE_MS) return

      clearPendingRefresh()
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null
        void refreshRef.current()
      }, ANALYTICS_RETURN_DEBOUNCE_MS)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markInactive()
        return
      }
      refreshIfStale()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", markInactive)
    window.addEventListener("focus", refreshIfStale)
    refreshIfStale()

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", markInactive)
      window.removeEventListener("focus", refreshIfStale)
      clearPendingRefresh()
    }
  }, [active])
}
