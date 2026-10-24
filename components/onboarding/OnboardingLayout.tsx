"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check, UserPlus, Mail, Building2, MapPin, CreditCard, Rocket } from "lucide-react"
import type { OnboardingStep } from "@/hooks/use-onboarding"

interface Step {
  key: OnboardingStep
  label: string
  icon: React.ReactNode
}

const STEPS: Step[] = [
  { key: "create_account",    label: "Create Account",    icon: <UserPlus className="w-4 h-4" /> },
  { key: "verify_email",      label: "Verify Email",      icon: <Mail className="w-4 h-4" /> },
  { key: "business_identity", label: "Business Identity", icon: <Building2 className="w-4 h-4" /> },
  { key: "location",          label: "Location",          icon: <MapPin className="w-4 h-4" /> },
  { key: "plan",              label: "Choose Plan",       icon: <CreditCard className="w-4 h-4" /> },
  { key: "complete",          label: "Complete",          icon: <Rocket className="w-4 h-4" /> },
]

function getStepIndex(step: OnboardingStep): number {
  return STEPS.findIndex((s) => s.key === step)
}

interface OnboardingLayoutProps {
  currentStep: OnboardingStep
  children: React.ReactNode
}

export function OnboardingLayout({ currentStep, children }: OnboardingLayoutProps) {
  const activeIndex = getStepIndex(currentStep)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f13] via-[#1a1224] to-[#0d1117] flex flex-col">
      {/* Ambient background blobs */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#EA601A]/20 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#7c3aed]/15 rounded-full blur-[140px]" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] bg-[#EA601A]/8 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 lg:px-10 border-b border-white/5 backdrop-blur-sm bg-black/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-[#EA601A]/30 flex items-center justify-center bg-white">
            <img src="/chillow-mark.png" alt="Chillow" className="w-full h-full object-contain" />
          </div>
          <span className="font-black text-white text-lg tracking-tight">Chillow</span>
        </div>
        <span className="text-xs font-medium text-white/30 hidden sm:block">
          Step {Math.min(activeIndex + 1, STEPS.length)} of {STEPS.length}
        </span>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Sidebar progress — desktop */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-r border-white/5 bg-white/[0.02] px-8 py-10 shrink-0">
          <p className="text-xs font-bold text-white/30 uppercase tracking-[0.15em] mb-8">Your progress</p>
          <nav className="flex flex-col gap-1">
            {STEPS.map((step, idx) => {
              const isDone = idx < activeIndex
              const isActive = idx === activeIndex
              return (
                <div key={step.key} className="flex items-center gap-4 group">
                  {/* Connector */}
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={{
                        backgroundColor: isDone ? "#EA601A" : isActive ? "#EA601A" : "rgba(255,255,255,0.08)",
                        scale: isActive ? 1.1 : 1,
                        boxShadow: isActive ? "0 0 0 4px rgba(234,96,26,0.2)" : "none",
                      }}
                      transition={{ duration: 0.3 }}
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/10"
                    >
                      {isDone ? (
                        <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                      ) : (
                        <span className={isActive ? "text-white" : "text-white/30"}>
                          {step.icon}
                        </span>
                      )}
                    </motion.div>
                    {idx < STEPS.length - 1 && (
                      <motion.div
                        animate={{ backgroundColor: isDone ? "#EA601A" : "rgba(255,255,255,0.06)" }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="w-0.5 h-8 my-1 rounded-full"
                      />
                    )}
                  </div>
                  <div className="pb-8 pt-0.5">
                    <p className={`text-sm font-semibold transition-colors ${
                      isActive ? "text-white" : isDone ? "text-[#EA601A]" : "text-white/25"
                    }`}>
                      {step.label}
                    </p>
                    {isDone && (
                      <p className="text-[11px] text-[#EA601A]/60 font-medium mt-0.5">Completed</p>
                    )}
                    {isActive && (
                      <p className="text-[11px] text-white/40 font-medium mt-0.5">In progress</p>
                    )}
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="mt-auto pt-8 border-t border-white/5">
            <p className="text-[11px] text-white/20 leading-relaxed">
              Your progress is saved automatically. You can safely close this tab and resume later.
            </p>
          </div>
        </aside>

        {/* Mobile progress bar */}
        <div className="lg:hidden px-5 pt-5 pb-2">
          <div className="flex items-center gap-1 mb-2">
            {STEPS.map((step, idx) => (
              <motion.div
                key={step.key}
                animate={{
                  backgroundColor:
                    idx < activeIndex ? "#EA601A" : idx === activeIndex ? "#EA601A" : "rgba(255,255,255,0.08)",
                  opacity: idx === activeIndex ? 1 : idx < activeIndex ? 0.8 : 0.3,
                }}
                transition={{ duration: 0.3 }}
                className="h-1 rounded-full flex-1"
              />
            ))}
          </div>
          <p className="text-xs text-white/40 font-medium">
            {STEPS[activeIndex]?.label} — Step {activeIndex + 1} of {STEPS.length}
          </p>
        </div>

        {/* Main content area */}
        <main className="flex-1 flex items-start lg:items-center justify-center p-4 sm:p-6 lg:p-10 overflow-y-auto">
          <div className="w-full max-w-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
