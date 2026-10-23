"use client"

import { useEffect, useState, type FormEvent } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, CreditCard, Loader2, Zap, Star, Rocket, Building } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/axios-config"
import type { BusinessData } from "@/hooks/use-onboarding"

type PlanFeature = string | { label?: string; name?: string; title?: string }

interface RawPlan {
  _id?: string
  id?: string
  planId?: string
  name?: string
  slug?: string
  level?: number | string
  monthlyPrice?: number | string
  price?: number | string
  amount?: number | string
  currency?: string
  description?: string
  commissionPercentage?: number | string
  offlineCommissionRate?: number | string
  isActive?: boolean
  features?: PlanFeature[]
  includedFeatures?: PlanFeature[]
  benefits?: PlanFeature[]
  badge?: string
  label?: string
  isPopular?: boolean
  metadata?: {
    features?: PlanFeature[]
    badge?: string
    isPopular?: boolean
    billingInterval?: string
  }
  billingInterval?: string
}

interface Plan {
  id: string
  name: string
  slug: string
  level: number
  monthlyPrice: number
  currency: string
  description?: string
  commissionPercentage?: number
  offlineCommissionRate?: number
  isActive: boolean
  features: string[]
  badge?: string
  isPopular: boolean
  billingInterval: string
}

interface Props {
  initial?: Partial<BusinessData>
  onComplete: (data: BusinessData) => Promise<{ success: boolean; message?: string }>
  onBack: () => void
  isLoading: boolean
}

const PLAN_ICONS = [Zap, Star, Rocket, Building]
const PLAN_COLORS = [
  { bg: "from-slate-500/20 to-slate-600/10", border: "border-slate-500/30", accent: "text-slate-300", badge: "bg-slate-500/20 text-slate-300", glow: "shadow-slate-500/10" },
  { bg: "from-[#EA601A]/20 to-orange-600/10", border: "border-[#EA601A]/40", accent: "text-[#EA601A]", badge: "bg-[#EA601A]/20 text-[#EA601A]", glow: "shadow-[#EA601A]/20" },
  { bg: "from-violet-500/20 to-purple-600/10", border: "border-violet-500/30", accent: "text-violet-300", badge: "bg-violet-500/20 text-violet-300", glow: "shadow-violet-500/10" },
  { bg: "from-sky-500/20 to-blue-600/10", border: "border-sky-500/30", accent: "text-sky-300", badge: "bg-sky-500/20 text-sky-300", glow: "shadow-sky-500/10" },
]

const pickPlansArray = (payload: unknown): RawPlan[] => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== "object") return []

  const data = payload as { plans?: unknown; data?: unknown; value?: unknown; results?: unknown }
  if (Array.isArray(data.plans)) return data.plans
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.value)) return data.value
  if (Array.isArray(data.results)) return data.results

  return []
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const featureLabel = (feature: PlanFeature) => {
  if (typeof feature === "string") return feature
  return feature.label || feature.name || feature.title || ""
}

const normalizePlan = (rawPlan: RawPlan): Plan | null => {
  const slug = rawPlan.slug?.trim()
  const id = rawPlan._id || rawPlan.id || rawPlan.planId || slug
  const name = rawPlan.name?.trim() || slug

  if (!id || !slug || !name) return null

  const features = [
    ...(rawPlan.features ?? []),
    ...(rawPlan.includedFeatures ?? []),
    ...(rawPlan.benefits ?? []),
    ...(rawPlan.metadata?.features ?? []),
  ].map(featureLabel).filter(Boolean)

  return {
    id,
    name,
    slug,
    level: toNumber(rawPlan.level, 0),
    monthlyPrice: toNumber(rawPlan.monthlyPrice ?? rawPlan.price ?? rawPlan.amount, 0),
    currency: rawPlan.currency || "EUR",
    description: rawPlan.description,
    commissionPercentage: rawPlan.commissionPercentage === undefined ? undefined : toNumber(rawPlan.commissionPercentage),
    offlineCommissionRate: rawPlan.offlineCommissionRate === undefined ? undefined : toNumber(rawPlan.offlineCommissionRate),
    isActive: rawPlan.isActive !== false,
    features,
    badge: rawPlan.badge || rawPlan.label || rawPlan.metadata?.badge,
    isPopular: Boolean(rawPlan.isPopular ?? rawPlan.metadata?.isPopular),
    billingInterval: rawPlan.billingInterval || rawPlan.metadata?.billingInterval || "month",
  }
}

const getPlanFacts = (plan: Plan) => {
  const facts: string[] = []

  if (plan.offlineCommissionRate !== undefined) {
    facts.push(`${plan.offlineCommissionRate}% offline commission`)
  }

  if (plan.commissionPercentage !== undefined && plan.commissionPercentage !== plan.offlineCommissionRate) {
    facts.push(`${plan.commissionPercentage}% online commission`)
  }

  if (plan.level > 0) {
    facts.push(`Level ${plan.level}`)
  }

  return facts
}

const getDisplayFeatures = (plan: Plan) => {
  const databaseFeatures = plan.features.length > 0 ? plan.features : getPlanFacts(plan)
  return databaseFeatures.slice(0, 3)
}

const formatPrice = (plan: Plan) => {
  if (plan.monthlyPrice <= 0) return "Free"

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: plan.currency,
      maximumFractionDigits: Number.isInteger(plan.monthlyPrice) ? 0 : 2,
    }).format(plan.monthlyPrice)
  } catch {
    return `${plan.currency} ${plan.monthlyPrice}`
  }
}

export function ChoosePlanStep({ initial, onComplete, onBack, isLoading }: Props) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initial?.planId ?? "")
  const [selectedPlan, setSelectedPlan] = useState<string>(initial?.plan ?? "")
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPlans() {
      setFetchLoading(true)
      setFetchError(null)

      try {
        let response

        try {
          response = await apiClient.get("/public/plans")
        } catch {
          response = await apiClient.get("/onboarding/plans")
        }

        if (cancelled) return

        const databasePlans = pickPlansArray(response.data)
          .map(normalizePlan)
          .filter((plan): plan is Plan => Boolean(plan))
          .filter((plan) => plan.isActive)
          .sort((a, b) => a.level - b.level || a.monthlyPrice - b.monthlyPrice)

        setPlans(databasePlans)

        const preselectedPlan = databasePlans.find((plan) => (
          plan.id === initial?.planId || plan.slug === initial?.plan
        ))
        const defaultPlan = preselectedPlan ?? databasePlans[0]

        if (defaultPlan) {
          setSelectedPlanId(defaultPlan.id)
          setSelectedPlan(defaultPlan.slug)
        }
      } catch {
        if (!cancelled) {
          setFetchError("Unable to load plans. Please try again.")
        }
      } finally {
        if (!cancelled) {
          setFetchLoading(false)
        }
      }
    }

    loadPlans()

    return () => {
      cancelled = true
    }
  }, [initial?.plan, initial?.planId])

  const handleSelect = (plan: Plan) => {
    setSelectedPlanId(plan.id)
    setSelectedPlan(plan.slug)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const plan = plans.find((plan) => plan.id === selectedPlanId)

    if (!plan) {
      toast.error("Please select a plan to continue")
      return
    }

    const result = await onComplete({
      planId: plan.id,
      plan: plan.slug || selectedPlan,
      currentPlan: plan.slug || selectedPlan,
      planName: plan.name,
      planMonthlyPrice: plan.monthlyPrice,
      planCurrency: plan.currency,
      planOfflineCommissionRate: plan.offlineCommissionRate,
      planCommissionPercentage: plan.commissionPercentage,
    })

    if (!result.success) {
      toast.error(result.message || "Failed to save plan selection")
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#EA601A]/10 border border-[#EA601A]/20 flex items-center justify-center mb-4">
          <CreditCard className="w-6 h-6 text-[#EA601A]" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Choose your plan</h1>
        <p className="text-white/40 text-sm leading-relaxed">
          Start with any plan - you can upgrade or change at any time from your dashboard.
        </p>
      </div>

      {fetchLoading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-[#EA601A] animate-spin" />
          <p className="text-white/30 text-sm">Loading plans...</p>
        </div>
      ) : fetchError ? (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center">
          {fetchError}
        </div>
      ) : plans.length === 0 ? (
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 text-white/40 text-sm text-center">
          No active plans are available right now.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            {plans.map((plan, idx) => {
              const color = PLAN_COLORS[Math.min(idx, PLAN_COLORS.length - 1)]
              const Icon = PLAN_ICONS[Math.min(idx, PLAN_ICONS.length - 1)]
              const features = getDisplayFeatures(plan)
              const isSelected = selectedPlanId === plan.id
              const isFree = plan.monthlyPrice === 0

              return (
                <motion.button
                  key={plan.id}
                  type="button"
                  onClick={() => handleSelect(plan)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? `bg-gradient-to-br ${color.bg} ${color.border} shadow-xl ${color.glow}`
                      : "bg-white/3 border-white/8 hover:border-white/15 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? `bg-gradient-to-br ${color.bg} border ${color.border}` : "bg-white/5 border border-white/8"
                    }`}>
                      <Icon className={`w-5 h-5 ${isSelected ? color.accent : "text-white/30"}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-white text-base">{plan.name}</span>
                        {isFree && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.badge}`}>
                            No monthly fee
                          </span>
                        )}
                        {(plan.isPopular || plan.badge) && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EA601A]/20 text-[#EA601A]">
                            {plan.badge || "Most popular"}
                          </span>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-xs text-white/40 mb-2 leading-relaxed">{plan.description}</p>
                      )}
                      {features.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {features.map((feature) => (
                            <span key={feature} className="flex items-center gap-1 text-xs text-white/30">
                              <Check className="w-2.5 h-2.5 text-white/25" strokeWidth={3} />
                              {feature}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <div className={`text-xl font-black ${isSelected ? color.accent : "text-white/60"}`}>
                          {formatPrice(plan)}
                        </div>
                        {!isFree && <div className="text-xs text-white/25">/{plan.billingInterval}</div>}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? "border-[#EA601A] bg-[#EA601A]" : "border-white/20 bg-transparent"
                      }`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>

          <p className="text-xs text-center text-white/20">
            Commission rates may apply. Review the full pricing details in your dashboard after setup.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="h-13 py-3.5 px-6 rounded-2xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 font-bold text-sm transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedPlanId}
              className="flex-1 h-13 py-3.5 rounded-2xl bg-gradient-to-r from-[#EA601A] to-[#ff8c42] hover:from-[#D45618] hover:to-[#EA601A] text-white font-bold text-base shadow-xl shadow-[#EA601A]/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
              ) : (
                <>Continue <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
