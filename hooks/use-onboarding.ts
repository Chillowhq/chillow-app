"use client"

import { useState, useCallback } from "react"
import { apiClient } from "@/lib/axios-config"

export type OnboardingStep =
  | "create_account"
  | "verify_email"
  | "business_identity"
  | "location"
  | "plan"
  | "complete"

export interface BusinessData {
  name?: string
  displayName?: string
  businessType?: string
  venueType?: string
  slug?: string
  contactEmail?: string
  phoneNumber?: string
  country?: string
  countryCode?: string
  address?: string
  addressPlaceId?: string
  addressSessionToken?: string
  latitude?: number
  longitude?: number
  currency?: string
  timezone?: string
  language?: string
  plan?: string
  currentPlan?: string
  planId?: string
  planName?: string
  planMonthlyPrice?: number
  planCurrency?: string
  planOfflineCommissionRate?: number
  planCommissionPercentage?: number
}

export interface OnboardingSessionData {
  sessionId: string
  currentStep: OnboardingStep
  emailVerified: boolean
  ownerEmail: string
  ownerName: string
  businessData: BusinessData
}

const SESSION_STORAGE_KEY = "qs_onboarding_session"

// A selected venue type is authoritative for new onboarding sessions. Never
// resend a legacy shell alongside it: the backend derives that value and its
// operational modules, then returns the canonical session data.
export function withoutConflictingLegacyBusinessType(businessData: BusinessData): BusinessData {
  const normalized = { ...businessData }
  if (typeof normalized.venueType === "string" && normalized.venueType) {
    delete normalized.businessType
  }
  return normalized
}

export function mergeOnboardingBusinessData(
  currentBusinessData: BusinessData | undefined,
  nextBusinessData: BusinessData,
): BusinessData {
  return withoutConflictingLegacyBusinessType({
    ...(currentBusinessData ?? {}),
    ...nextBusinessData,
  })
}

export function useOnboarding() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("create_account")
  const [sessionData, setSessionData] = useState<Partial<OnboardingSessionData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── localStorage helpers ───────────────────────────────────────────────────
  const persistSessionId = useCallback((id: string) => {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, id)
    } catch {
      /* ignore SSR / private-browsing */
    }
  }, [])

  const clearPersistedSession = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const getPersistedSessionId = useCallback((): string | null => {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY)
    } catch {
      return null
    }
  }, [])

  // ─── Resume session on mount ───────────────────────────────────────────────
  const resumeSession = useCallback(async (): Promise<OnboardingSessionData | null> => {
    const id = getPersistedSessionId()
    if (!id) return null

    try {
      const res = await apiClient.get(`/onboarding/session/${id}`)
      const data: OnboardingSessionData = { ...res.data, sessionId: id }
      setSessionId(id)
      setCurrentStep(data.currentStep)
      setSessionData(data)
      return data
    } catch {
      // Session expired or not found — start fresh
      clearPersistedSession()
      return null
    }
  }, [getPersistedSessionId, clearPersistedSession])

  // ─── Step 1: Create Account ────────────────────────────────────────────────
  const createAccount = useCallback(
    async (payload: {
      firstName: string
      lastName: string
      email: string
      password: string
      termsAccepted: boolean
    }) => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await apiClient.post("/onboarding/signup", payload)
        const id: string = res.data.sessionId
        setSessionId(id)
        persistSessionId(id)
        setSessionData((prev) => ({
          ...prev,
          sessionId: id,
          ownerEmail: payload.email,
          ownerName: `${payload.firstName} ${payload.lastName}`,
        }))
        setCurrentStep("verify_email")
        return { success: true }
      } catch (err: any) {
        const message = err.response?.data?.message || "Failed to create account"
        setError(message)
        return { success: false, message, code: err.response?.data?.code as string | undefined }
      } finally {
        setIsLoading(false)
      }
    },
    [persistSessionId]
  )

  // ─── Step 2: Verify Email ──────────────────────────────────────────────────
  const verifyEmail = useCallback(
    async (email: string, token: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await apiClient.post("/onboarding/verify-email", { email, token })
        const returnedId: string = res.data.sessionId
        // Update session id in case it differs (e.g. resumed from URL params)
        setSessionId(returnedId)
        persistSessionId(returnedId)
        setSessionData((prev) => ({
          ...prev,
          sessionId: returnedId,
          emailVerified: true,
        }))
        setCurrentStep("business_identity")
        return { success: true }
      } catch (err: any) {
        const message = err.response?.data?.message || "Verification failed"
        setError(message)
        return { success: false, message, code: err.response?.data?.code as string | undefined }
      } finally {
        setIsLoading(false)
      }
    },
    [persistSessionId]
  )

  // ─── Steps 3-5: Save step data ────────────────────────────────────────────
  const saveStepData = useCallback(
    async (nextStep: OnboardingStep, businessData: BusinessData) => {
      const id = sessionId || getPersistedSessionId()
      if (!id) return { success: false, message: "No active session" }

      setIsLoading(true)
      setError(null)
      try {
        const mergedBusinessData = mergeOnboardingBusinessData(sessionData.businessData, businessData)
        const selectedPlan = mergedBusinessData.plan ?? mergedBusinessData.currentPlan
        const businessDataToSave = selectedPlan
          ? { ...mergedBusinessData, plan: selectedPlan, currentPlan: selectedPlan }
          : mergedBusinessData

        const res = await apiClient.patch(`/onboarding/session/${id}`, {
          currentStep: nextStep,
          businessData: businessDataToSave,
          planId: businessDataToSave.planId,
          plan: businessDataToSave.plan,
          currentPlan: businessDataToSave.currentPlan,
        })
        const savedBusinessData = res.data.businessData ?? businessDataToSave
        setSessionData((prev) => ({
          ...prev,
          businessData: savedBusinessData,
          currentStep: nextStep,
        }))
        setCurrentStep(nextStep)
        return { success: true }
      } catch (err: any) {
        const message = err.response?.data?.message || "Failed to save progress"
        setError(message)
        return { success: false, message }
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, getPersistedSessionId, sessionData.businessData]
  )

  // ─── Go back a step (client-only, no API call) ────────────────────────────
  const goBack = useCallback((step: OnboardingStep) => {
    setCurrentStep(step)
  }, [])

  // ─── Step 6: Complete Onboarding ──────────────────────────────────────────
  const completeOnboarding = useCallback(async () => {
    const id = sessionId || getPersistedSessionId()
    if (!id) return { success: false, message: "No active session" }

    setIsLoading(true)
    setError(null)
    try {
      const businessData = withoutConflictingLegacyBusinessType(sessionData.businessData ?? {})
      const selectedPlan = businessData.plan ?? businessData.currentPlan
      const businessDataToComplete = selectedPlan
        ? { ...businessData, plan: selectedPlan, currentPlan: selectedPlan }
        : businessData

      const res = await apiClient.post(`/onboarding/session/${id}/complete`, {
        businessData: businessDataToComplete,
        planId: businessDataToComplete.planId,
        plan: businessDataToComplete.plan,
        currentPlan: businessDataToComplete.currentPlan,
        planOfflineCommissionRate: businessDataToComplete.planOfflineCommissionRate,
        planCommissionPercentage: businessDataToComplete.planCommissionPercentage,
      })
      clearPersistedSession()
      return { success: true, businessId: res.data.businessId, slug: res.data.slug }
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to complete onboarding"
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, getPersistedSessionId, clearPersistedSession, sessionData.businessData])

  return {
    // State
    sessionId,
    currentStep,
    sessionData,
    isLoading,
    error,
    // Actions
    resumeSession,
    createAccount,
    verifyEmail,
    saveStepData,
    goBack,
    completeOnboarding,
    // Raw React setters (for URL param driven flows in the page component)
    setCurrentStep,
    setSessionData,
    setSessionId,
    persistSessionId,
  }
}
