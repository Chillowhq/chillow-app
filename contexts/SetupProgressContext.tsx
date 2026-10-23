"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { SetupProgress } from "@/components/owner/GuidedSetupChecklist"
import { useAuthContext } from "@/contexts/AuthContext"
import { apiClient } from "@/lib/axios-config"

interface SetupProgressContextType {
  progress: SetupProgress | null
  loading: boolean
  error: Error | null
  refreshSetupProgress: () => Promise<void>
}

const SetupProgressContext = createContext<SetupProgressContextType | undefined>(undefined)

export function SetupProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext()
  const [progress, setProgress] = useState<SetupProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchProgress = useCallback(async () => {
    if (!user || !["owner", "co_owner"].includes(user.role)) {
      setProgress(null)
      return
    }

    try {
      setLoading(true)
      const res = await apiClient.get('/owner/setup-progress')
      setProgress(res.data)
      setError(null)
    } catch (err) {
      console.error("[SetupProgressContext] fetch error:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  return (
    <SetupProgressContext.Provider
      value={{
        progress,
        loading,
        error,
        refreshSetupProgress: fetchProgress
      }}
    >
      {children}
    </SetupProgressContext.Provider>
  )
}

export function useSetupProgress() {
  const context = useContext(SetupProgressContext)
  if (context === undefined) {
    throw new Error("useSetupProgress must be used within a SetupProgressProvider")
  }
  return context
}
