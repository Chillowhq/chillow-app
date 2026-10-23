"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, Building2, Check, CreditCard, Globe, Loader2, MapPin, Rocket, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { BusinessData } from "@/hooks/use-onboarding"

interface Props {
  sessionData: {
    ownerName?: string
    ownerEmail?: string
    businessData?: BusinessData
  }
  onComplete: () => Promise<{ success: boolean; message?: string; businessId?: string; slug?: string }>
  onBack: () => void
  isLoading: boolean
}

const formatCurrency = (amount: number, currency = "EUR") => {
  if (amount <= 0) return "Free"

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

const titleCase = (value?: string) => {
  if (!value) return "-"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function CompleteStep({ sessionData, onComplete, onBack, isLoading }: Props) {
  const router = useRouter()
  const [launched, setLaunched] = useState(false)

  const { businessData = {}, ownerName = "", ownerEmail = "" } = sessionData
  const planPrice = Number(businessData.planMonthlyPrice ?? 0)
  const planCommissionLabel = businessData.planOfflineCommissionRate !== undefined
    ? `${businessData.planOfflineCommissionRate}% offline commission`
    : undefined
  const planSubLabel = businessData.plan
    ? [formatCurrency(planPrice, businessData.planCurrency), planCommissionLabel].filter(Boolean).join(" - ")
    : undefined

  const summaryItems = [
    {
      icon: <Building2 className="w-4 h-4" />,
      label: "Business",
      value: businessData.displayName || businessData.name || "-",
      sub: businessData.businessType?.replace(/_/g, " "),
    },
    {
      icon: <Globe className="w-4 h-4" />,
      label: "URL",
      value: businessData.slug ? `chillow.io/${businessData.slug}` : "-",
    },
    {
      icon: <MapPin className="w-4 h-4" />,
      label: "Location",
      value: businessData.country || "-",
      sub: businessData.currency ? `${businessData.currency} - ${businessData.timezone?.split("/").pop()}` : undefined,
    },
    {
      icon: <CreditCard className="w-4 h-4" />,
      label: "Plan",
      value: businessData.planName || titleCase(businessData.plan),
      sub: planSubLabel,
    },
  ]

  const handleLaunch = async () => {
    const result = await onComplete()
    if (result.success) {
      setLaunched(true)
      setTimeout(() => {
        router.push("/owner")
      }, 3000)
    } else {
      toast.error(result.message || "Failed to create your business. Please try again.")
    }
  }

  if (launched) {
    return (
      <div className="flex flex-col items-center text-center py-10">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-[#EA601A] to-[#ff8c42] flex items-center justify-center mb-6 shadow-2xl shadow-[#EA601A]/40"
        >
          <Check className="w-12 h-12 text-white" strokeWidth={2.5} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-3xl font-black text-white mb-3">Your Chillow workspace is ready</h1>
          <p className="text-white/50 text-sm leading-relaxed mb-2">
            There are a few setup steps remaining before customers can fully use the business.
          </p>
          <p className="text-white/30 text-xs">
            Redirecting you to your dashboard...
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex gap-3"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              className="w-2 h-2 rounded-full bg-[#EA601A]"
            />
          ))}
        </motion.div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EA601A]/30 to-orange-600/10 border border-[#EA601A]/30 flex items-center justify-center mb-4">
          <Rocket className="w-6 h-6 text-[#EA601A]" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Ready to launch!</h1>
        <p className="text-white/40 text-sm leading-relaxed">
          Review your setup below. Clicking <strong className="text-white/60">Launch My Business</strong> will create your account and publish it on Chillow.
        </p>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#EA601A]" />
          <span className="text-sm font-bold text-white/70">Your Setup Summary</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EA601A]/30 to-orange-600/10 border border-[#EA601A]/20 flex items-center justify-center shrink-0">
              <span className="text-base font-black text-[#EA601A]">
                {ownerName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{ownerName}</p>
              <p className="text-xs text-white/30">{ownerEmail}</p>
            </div>
          </div>

          <div className="w-full h-px bg-white/5" />

          <div className="space-y-3">
            {summaryItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0 text-white/30">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/25 font-medium">{item.label}</p>
                  <p className="text-sm font-semibold text-white/80 truncate">{item.value}</p>
                  {item.sub && <p className="text-xs text-white/30 capitalize">{item.sub}</p>}
                </div>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#EA601A]/5 border border-[#EA601A]/15 p-4 mb-6">
        <p className="text-xs font-bold text-[#EA601A]/70 mb-2 uppercase tracking-wider">What happens next</p>
        <ul className="space-y-1.5">
          {[
            "Your business will be created and activated",
            "You'll be redirected to sign in with your credentials",
            "Complete your dashboard setup (hours, menu, service points)",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-white/40">
              <div className="w-4 h-4 rounded-full bg-[#EA601A]/20 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-[#EA601A]">
                {i + 1}
              </div>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="h-13 py-3.5 px-6 rounded-2xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleLaunch}
          disabled={isLoading}
          className="flex-1 h-13 py-3.5 rounded-2xl bg-gradient-to-r from-[#EA601A] to-[#ff8c42] hover:from-[#D45618] hover:to-[#EA601A] text-white font-bold text-base shadow-xl shadow-[#EA601A]/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2 group"
        >
          {isLoading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Launching...</>
          ) : (
            <><Rocket className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" /> Launch My Business</>
          )}
        </button>
      </div>
    </div>
  )
}
