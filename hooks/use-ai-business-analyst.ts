"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import apiClient from "@/lib/axios-config"
import { subDays, parseISO, format } from "date-fns"
import type {
  AnalystHistoryEntry,
  AnalystReport,
  LatestReportResponse,
  CurrentWeekMetadata,
  WeekMetadata,
  CurrentWeekSnapshotResponse,
  PeriodSelectorItem,
} from "@/types/ai-business-analyst"

export type CustomHistoryMonthGroup = {
  monthLabel: string
  items: PeriodSelectorItem[]
}

function formatPeriodLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${s.toLocaleDateString("en-US", opts)} \u2013 ${e.toLocaleDateString("en-US", opts)}`
}

export type SelectedView =
  | { type: "current-week" }
  | { type: "final-report"; periodKey: string }

export function useAiBusinessAnalyst(businessId?: string) {
  const [report, setReport] = useState<AnalystReport | null>(null)
  const [status, setStatus] = useState<"loading" | "not_generated" | "available" | "error">("loading")
  const [history, setHistory] = useState<AnalystHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedView, setSelectedView] = useState<SelectedView>({ type: "current-week" })

  const [currentWeek, setCurrentWeek] = useState<CurrentWeekMetadata | null>(null)
  const [latestCompletedWeek, setLatestCompletedWeek] = useState<WeekMetadata | null>(null)
  const [isLatestFinalMissing, setIsLatestFinalMissing] = useState(false)
  const [expectedFinalPeriodKey, setExpectedFinalPeriodKey] = useState<string | null>(null)

  const [currentWeekSnapshot, setCurrentWeekSnapshot] = useState<CurrentWeekSnapshotResponse | null>(null)
  const [currentWeekLoading, setCurrentWeekLoading] = useState(false)

  const fetchLatest = useCallback(async () => {
    if (!businessId) {
      setStatus("loading")
      return
    }
    setStatus("loading")
    try {
      const res = await apiClient.get<LatestReportResponse>(
        "/owner/ai-business-analyst/latest",
      )

      setCurrentWeek(res.data.currentWeek)
      setLatestCompletedWeek(res.data.latestCompletedWeek)
      setIsLatestFinalMissing(res.data.isLatestFinalMissing)
      setExpectedFinalPeriodKey(res.data.expectedFinalPeriodKey)

      if (res.data.status === "not_generated" || !res.data.report) {
        setReport(null)
        setStatus("not_generated")
        setSelectedView({ type: "current-week" })
      } else {
        setReport(res.data.report)
        setStatus("available")
        setSelectedView({ type: "final-report", periodKey: res.data.report.period.key })
      }
    } catch {
      setStatus("error")
    }
  }, [businessId])

  const fetchHistory = useCallback(async () => {
    if (!businessId) return
    setHistoryLoading(true)
    try {
      const res = await apiClient.get<{ reports: AnalystHistoryEntry[] }>(
        "/owner/ai-business-analyst/history?limit=20",
      )
      setHistory(res.data.reports || [])
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false)
    }
  }, [businessId])

  const fetchPeriod = useCallback(
    async (periodKey: string) => {
      if (!businessId) return
      setStatus("loading")
      try {
        const res = await apiClient.get<{ report: AnalystReport }>(
          `/owner/ai-business-analyst/${periodKey}`,
        )
        setReport(res.data.report)
        setStatus("available")
        setSelectedView({ type: "final-report", periodKey })
      } catch {
        setStatus("error")
      }
    },
    [businessId],
  )

  const fetchCurrentWeek = useCallback(async () => {
    if (!businessId) return
    setCurrentWeekLoading(true)
    try {
      const res = await apiClient.get<CurrentWeekSnapshotResponse>(
        "/owner/ai-business-analyst/current-week",
      )
      setCurrentWeekSnapshot(res.data)
    } catch {
      setCurrentWeekSnapshot(null)
    } finally {
      setCurrentWeekLoading(false)
    }
  }, [businessId])

  const selectCurrentWeek = useCallback(() => {
    setSelectedView({ type: "current-week" })
    if (businessId && currentWeekSnapshot === null) {
      fetchCurrentWeek()
    }
  }, [fetchCurrentWeek, businessId, currentWeekSnapshot])

  const selectFinalReport = useCallback(
    (periodKey: string) => {
      setSelectedView({ type: "final-report", periodKey })
      fetchPeriod(periodKey)
    },
    [fetchPeriod],
  )

  const { thisWeek, lastWeek, twoWeeksAgo, threeWeeksAgo, fourWeeksAgo, customHistory } = useMemo(() => {
    const items: PeriodSelectorItem[] = []

    if (currentWeek) {
      items.push({
        periodKey: currentWeek.periodKey,
        periodStart: currentWeek.periodStart,
        periodEnd: currentWeek.periodEnd,
        label: formatPeriodLabel(currentWeek.periodStart, currentWeek.periodEnd),
        badge: "live",
        isCurrentWeek: true,
        isSelectable: true,
      })
    }

    for (const h of history) {
      if (currentWeek && h.periodKey === currentWeek.periodKey) continue
      items.push({
        periodKey: h.periodKey,
        periodStart: h.periodStart,
        periodEnd: h.periodEnd,
        label: formatPeriodLabel(h.periodStart, h.periodEnd),
        badge:
          h.generationStatus === "completed"
            ? "final"
            : h.generationStatus === "generating" || h.generationStatus === "snapshot_ready"
              ? "generating"
              : "unavailable",
        isCurrentWeek: false,
        isSelectable: h.generationStatus === "completed",
      })
    }

    if (
      latestCompletedWeek &&
      isLatestFinalMissing &&
      !items.some((i) => i.periodKey === latestCompletedWeek.periodKey)
    ) {
      const insertIdx = items.findIndex((i) => !i.isCurrentWeek)
      const missingEntry: PeriodSelectorItem = {
        periodKey: latestCompletedWeek.periodKey,
        periodStart: latestCompletedWeek.periodStart,
        periodEnd: latestCompletedWeek.periodEnd,
        label: formatPeriodLabel(latestCompletedWeek.periodStart, latestCompletedWeek.periodEnd),
        badge: "generating",
        isCurrentWeek: false,
        isSelectable: false,
      }
      if (insertIdx >= 0) {
        items.splice(insertIdx, 0, missingEntry)
      } else {
        items.push(missingEntry)
      }
    }

    const refStart = currentWeek?.periodStart || latestCompletedWeek?.periodStart
    const refEnd = currentWeek?.periodEnd || latestCompletedWeek?.periodEnd

    const getExpectedItem = (daysBack: number): PeriodSelectorItem | null => {
      if (!refStart || !refEnd) return null
      const expectedDate = format(subDays(parseISO(refStart), daysBack), "yyyy-MM-dd")
      const found = items.find((i) => i.periodStart === expectedDate)
      if (found) return found
      
      const expectedEnd = format(subDays(parseISO(refEnd), daysBack), "yyyy-MM-dd")
      return {
        periodKey: `synthetic-${expectedDate}`,
        periodStart: expectedDate,
        periodEnd: expectedEnd,
        label: formatPeriodLabel(expectedDate, expectedEnd),
        badge: "unavailable",
        isCurrentWeek: false,
        isSelectable: false,
      }
    }

    const exactThisWeek = currentWeek ? items.find((i) => i.isCurrentWeek) || null : null
    const exactLastWeek = getExpectedItem(7)
    const exactTwoWeeksAgo = getExpectedItem(14)
    const exactThreeWeeksAgo = getExpectedItem(21)
    const exactFourWeeksAgo = getExpectedItem(28)

    const exactKeys = new Set([
      exactThisWeek?.periodKey,
      exactLastWeek?.periodKey,
      exactTwoWeeksAgo?.periodKey,
      exactThreeWeeksAgo?.periodKey,
      exactFourWeeksAgo?.periodKey,
    ].filter(Boolean))

    const remainingHistory = items.filter((i) => !exactKeys.has(i.periodKey))

    const customHistoryGroups: CustomHistoryMonthGroup[] = []
    for (const h of remainingHistory) {
      const date = parseISO(h.periodStart)
      const monthLabel = format(date, "MMMM yyyy")
      let group = customHistoryGroups.find((g) => g.monthLabel === monthLabel)
      if (!group) {
        group = { monthLabel, items: [] }
        customHistoryGroups.push(group)
      }
      group.items.push(h)
    }

    return {
      thisWeek: exactThisWeek,
      lastWeek: exactLastWeek,
      twoWeeksAgo: exactTwoWeeksAgo,
      threeWeeksAgo: exactThreeWeeksAgo,
      fourWeeksAgo: exactFourWeeksAgo,
      customHistory: customHistoryGroups,
    }
  }, [currentWeek, history, latestCompletedWeek, isLatestFinalMissing])

  useEffect(() => {
    fetchLatest()
  }, [fetchLatest])

  useEffect(() => {
    if (status === "available" || status === "not_generated") {
      fetchHistory()
    }
  }, [status, fetchHistory])

  useEffect(() => {
    if (selectedView.type === "current-week" && businessId && !currentWeekSnapshot) {
      fetchCurrentWeek()
    }
  }, [selectedView.type, businessId, fetchCurrentWeek, currentWeekSnapshot])

  return {
    report,
    status,
    history,
    historyLoading,
    selectedView,
    currentWeek,
    latestCompletedWeek,
    isLatestFinalMissing,
    expectedFinalPeriodKey,
    currentWeekSnapshot,
    currentWeekLoading,
    
    // Grouped periods
    thisWeek,
    lastWeek,
    twoWeeksAgo,
    threeWeeksAgo,
    fourWeeksAgo,
    customHistory,

    fetchLatest,
    fetchPeriod,
    selectCurrentWeek,
    selectFinalReport,
  }
}
