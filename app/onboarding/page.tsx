"use client"

import { useEffect, useRef, useState } from "react"
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout"
import { CreateAccountStep } from "@/components/onboarding/steps/CreateAccountStep"
import { VerifyEmailStep } from "@/components/onboarding/steps/VerifyEmailStep"
import { BusinessIdentityStep } from "@/components/onboarding/steps/BusinessIdentityStep"
import { LocationStep } from "@/components/onboarding/steps/LocationStep"
import { ChoosePlanStep } from "@/components/onboarding/steps/ChoosePlanStep"
import { CompleteStep } from "@/components/onboarding/steps/CompleteStep"
import { useOnboarding } from "@/hooks/use-onboarding"
import { Loader2 } from "lucide-react"

function OnboardingPageInner() {
  const {
    currentStep,
    sessionId,
    sessionData,
    isLoading,
    resumeSession,
    createAccount,
    verifyEmail,
    saveStepData,
    goBack,
    completeOnboarding,
  } = useOnboarding()

  const [initializing, setInitializing] = useState(true)
  const initDone = useRef(false)

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    async function init() {
      await resumeSession()
      setInitializing(false)
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBusinessIdentity = async (data: any) => {
    return saveStepData("location", data)
  }

  const handleLocation = async (data: any) => {
    return saveStepData("plan", data)
  }

  const handlePlan = async (data: any) => {
    return saveStepData("complete", data)
  }

  if (initializing) return <LoadingScreen />

  const renderStep = () => {
    switch (currentStep) {
      case "create_account":
        return (
          <CreateAccountStep
            onComplete={createAccount}
            isLoading={isLoading}
          />
        )

      case "verify_email":
        return (
          <VerifyEmailStep
            ownerEmail={sessionData.ownerEmail ?? ""}
            onComplete={verifyEmail}
            isLoading={isLoading}
          />
        )

      case "business_identity":
        return (
          <BusinessIdentityStep
            initial={sessionData.businessData}
            ownerEmail={sessionData.ownerEmail}
            onComplete={handleBusinessIdentity}
            onBack={() => goBack("verify_email")}
            isLoading={isLoading}
          />
        )

      case "location":
        return (
          <LocationStep
            sessionId={sessionId ?? ""}
            initial={sessionData.businessData}
            onComplete={handleLocation}
            onBack={() => goBack("business_identity")}
            isLoading={isLoading}
          />
        )

      case "plan":
        return (
          <ChoosePlanStep
            initial={sessionData.businessData}
            onComplete={handlePlan}
            onBack={() => goBack("location")}
            isLoading={isLoading}
          />
        )

      case "complete":
        return (
          <CompleteStep
            sessionData={sessionData as any}
            onComplete={completeOnboarding}
            onBack={() => goBack("plan")}
            isLoading={isLoading}
          />
        )

      default:
        return null
    }
  }

  return (
    <OnboardingLayout currentStep={currentStep}>
      {renderStep()}
    </OnboardingLayout>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f13] via-[#1a1224] to-[#0d1117] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-[#EA601A] animate-spin" />
        <p className="text-white/30 text-sm font-medium">Loading your session...</p>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return <OnboardingPageInner />
}
