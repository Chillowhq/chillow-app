"use client"

import { useState, useEffect, useRef } from "react"
import { Mail, Loader2, RotateCcw, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/axios-config"

interface Props {
  ownerEmail: string
  onComplete: (email: string, token: string) => Promise<{ success: boolean; message?: string; code?: string }>
  isLoading: boolean
}

const RESEND_COOLDOWN = 60 // seconds

export function VerifyEmailStep({ ownerEmail, onComplete, isLoading }: Props) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const [isResending, setIsResending] = useState(false)
  const [challengeNeedsResend, setChallengeNeedsResend] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const submitInFlight = useRef(false)
  const resendInFlight = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [cooldown])

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const chars = value.replace(/\D/g, "").slice(0, 6).split("")
      const newOtp = [...otp]
      chars.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char
      })
      setOtp(newOtp)
      const nextIndex = Math.min(index + chars.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    const newOtp = [...otp]
    const digit = value.replace(/\D/g, "").slice(0, 1)
    newOtp[index] = digit
    setOtp(newOtp)
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitInFlight.current || challengeNeedsResend) return
    const token = otp.join("")
    if (token.length !== 6) {
      toast.error("Please enter the full 6-digit code")
      return
    }

    if (!ownerEmail) {
      toast.error("We need your email address to verify this code.")
      return
    }

    submitInFlight.current = true
    try {
      const result = await onComplete(ownerEmail, token)
      if (!result.success) {
        toast.error(result.message || "Invalid or expired code. Please try again.")
        if (["VERIFICATION_CODE_EXPIRED", "VERIFICATION_ATTEMPTS_EXHAUSTED"].includes(result.code || "")) {
          setChallengeNeedsResend(true)
        }
        setOtp(["", "", "", "", "", ""])
        inputRefs.current[0]?.focus()
      }
    } finally {
      submitInFlight.current = false
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || isResending || resendInFlight.current) return
    if (!ownerEmail) {
      toast.error("Enter your email again to request a new code.")
      return
    }

    resendInFlight.current = true
    setIsResending(true)
    try {
      const res = await apiClient.post("/onboarding/resend-verification", { email: ownerEmail })
      toast.success(res.data?.message || "Verification code sent.")
      setChallengeNeedsResend(false)
      setCooldown(RESEND_COOLDOWN)
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to resend. Please try again shortly.")
      const retryAfter = Number(err.response?.data?.retryAfterSeconds)
      if (Number.isFinite(retryAfter) && retryAfter > 0) setCooldown(Math.ceil(retryAfter))
    } finally {
      setIsResending(false)
      resendInFlight.current = false
    }
  }

  const masked = ownerEmail.replace(/(.{2}).+(@.+)/, "$1***$2")
  const filled = otp.join("").length === 6
  const resendHelpText =
    cooldown > 0
      ? `Didn't get the email? Resend in ${cooldown}s`
      : "Didn't get the email? You can resend it now."

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
          <Mail className="w-6 h-6 text-blue-400" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Check your inbox</h1>
        <p className="text-white/40 text-sm leading-relaxed">
          We sent a 6-digit code to{" "}
          <span className="text-white/70 font-medium">{masked}</span>.
          Enter it below to verify your email address.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-white/70 mb-3">
            Verification Code
          </label>
          <div className="grid grid-cols-6 gap-1.5 sm:gap-3 w-full max-w-full">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-full min-w-0 h-12 sm:h-14 rounded-xl sm:rounded-2xl text-center text-base sm:text-xl font-bold text-white border transition-all outline-none ${
                  digit
                    ? "bg-[#EA601A]/15 border-[#EA601A]/50 shadow-lg shadow-[#EA601A]/10"
                    : "bg-white/5 border-white/10 hover:border-white/20 focus:border-[#EA601A]/50 focus:bg-[#EA601A]/5"
                }`}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !filled || challengeNeedsResend}
          className="w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-[#EA601A] to-[#ff8c42] hover:from-[#D45618] hover:to-[#EA601A] text-white font-bold text-base shadow-xl shadow-[#EA601A]/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2 group"
        >
          {isLoading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Verifying...</>
          ) : (
            <>Verify Email <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>
          )}
        </button>
      </form>

      {challengeNeedsResend && (
        <p className="mt-3 text-sm font-medium text-amber-300" role="alert">
          This code can no longer be used. Request a new code to continue.
        </p>
      )}

      <div className="mt-6 p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/50">{resendHelpText}</p>
        </div>
        <button
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          className="flex items-center gap-1.5 text-sm font-bold text-[#EA601A] hover:text-[#ff8c42] disabled:text-white/20 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
          Resend
        </button>
      </div>

      <p className="text-xs text-center text-white/20 mt-4">
        Also check your spam/junk folder. The code expires in 30 minutes.
      </p>
    </div>
  )
}
