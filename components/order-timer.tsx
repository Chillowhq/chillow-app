"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

import { formatTime } from "@/lib/localization"
import { formatOrderAge } from "@/lib/utils"

interface OrderTimerProps {
  createdAt: string | Date
  timezone?: string
  showAbsolute?: boolean
  variant?: "default" | "severity"
}

export function OrderTimer({ createdAt, timezone, showAbsolute = false, variant = "default" }: OrderTimerProps) {
  const [elapsed, setElapsed] = useState({ display: "", severity: "green" })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const orderTime = new Date(createdAt).getTime()
    const calculateElapsed = () => {
      const now = new Date().getTime()
      const diffMs = Math.max(0, now - orderTime)
      const seconds = Math.floor(diffMs / 1000)
      return formatOrderAge(seconds)
    }

    setElapsed(calculateElapsed())
    const interval = setInterval(() => {
      setElapsed(calculateElapsed())
    }, 1000)

    return () => clearInterval(interval)
  }, [createdAt])

  if (!mounted) return null

  if (variant === "severity") {
    const severityClasses = {
      green: "bg-green-100 text-green-700 dark:bg-green-950/50 border border-green-200 dark:border-green-900",
      yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-900",
      orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900",
      red: "bg-red-100 text-red-600 dark:bg-red-950/50 border border-red-200 dark:border-red-900"
    }
    
    const severity = elapsed.severity || "green"
    const classes = severityClasses[severity as keyof typeof severityClasses]

    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-bold transition-colors shadow-sm ${classes} ${severity === 'red' ? 'animate-pulse' : ''}`}
      >
        <Clock className="w-3.5 h-3.5" />
        {elapsed.display}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span>
        {elapsed.display}
        {showAbsolute && timezone && (
          <span className="ml-1 opacity-70">({formatTime(createdAt, timezone)})</span>
        )}
      </span>
    </div>
  )
}
