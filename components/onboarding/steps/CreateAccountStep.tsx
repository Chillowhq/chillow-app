"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Eye, EyeOff, UserPlus, Loader2, Check, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import type { useOnboarding } from "@/hooks/use-onboarding"
import {
  PASSWORD_MAX_UTF8_BYTES,
  PASSWORD_MIN_CHARACTERS,
  PASSWORD_POLICY_MESSAGE,
  validateNewPassword,
} from "@/lib/password-policy"

interface Props {
  onComplete: ReturnType<typeof useOnboarding>["createAccount"]
  isLoading: boolean
}

function PasswordStrength({ password }: { password: string }) {
  const validation = validateNewPassword(password)
  const checks = [
    { label: `${PASSWORD_MIN_CHARACTERS}+ characters`, ok: validation.characterCount >= PASSWORD_MIN_CHARACTERS },
    { label: `At most ${PASSWORD_MAX_UTF8_BYTES} UTF-8 bytes`, ok: validation.utf8Bytes <= PASSWORD_MAX_UTF8_BYTES },
  ]
  const strength = checks.filter((c) => c.ok).length
  const colors = ["bg-yellow-500", "bg-green-500"]
  const labels = ["Check length", "Ready"]

  if (!password) return null

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: i < strength ? 1 : 0.2 }}
            transition={{ duration: 0.2 }}
            className={`h-1 flex-1 rounded-full ${i < strength ? colors[strength - 1] : "bg-white/10"}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {checks.map((c) => (
            <span key={c.label} className={`flex items-center gap-1 text-[11px] font-medium ${c.ok ? "text-green-400" : "text-white/25"}`}>
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
              {c.label}
            </span>
          ))}
        </div>
        {strength > 0 && (
          <span className={`text-xs font-bold ${colors[strength - 1].replace("bg-", "text-")}`}>
            {labels[strength - 1]}
          </span>
        )}
      </div>
    </div>
  )
}

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
  rightSlot?: React.ReactNode
  hint?: string
}

function Field({ id, label, value, onChange, type = "text", placeholder, required, autoComplete, rightSlot, hint }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-white/70">
        {label}
        {required && <span className="text-[#EA601A] ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className="w-full h-12 px-4 pr-12 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EA601A]/50 focus:border-[#EA601A]/50 transition-all hover:border-white/20"
        />
        {rightSlot && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
      {hint && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  )
}

export function CreateAccountStep({ onComplete, isLoading }: Props) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [terms, setTerms] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    if (!validateNewPassword(password).valid) {
      toast.error(PASSWORD_POLICY_MESSAGE)
      return
    }
    if (!terms) {
      toast.error("Please accept the terms and conditions")
      return
    }
    if (isLoading) return
    const result = await onComplete({ firstName, lastName, email, password, termsAccepted: terms })
    if (!result.success) {
      toast.error(result.message)
    }
  }

  const eyeBtn = (show: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} tabIndex={-1} className="text-white/30 hover:text-white/60 transition-colors">
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  )

  return (
    <div>
      {/* Step header */}
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#EA601A]/15 border border-[#EA601A]/20 flex items-center justify-center mb-4">
          <UserPlus className="w-6 h-6 text-[#EA601A]" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Create your account</h1>
        <p className="text-white/40 text-sm leading-relaxed">
          Set up your QuickServe owner account. You&apos;ll verify your email in the next step.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <Field id="ob-first-name" label="First Name" value={firstName} onChange={setFirstName} placeholder="John" required autoComplete="given-name" />
          <Field id="ob-last-name" label="Last Name" value={lastName} onChange={setLastName} placeholder="Smith" required autoComplete="family-name" />
        </div>

        <Field
          id="ob-email"
          label="Email Address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="john@myrestaurant.com"
          required
          autoComplete="email"
        />

        <div className="space-y-1.5">
          <label htmlFor="ob-password" className="block text-sm font-semibold text-white/70">
            Password<span className="text-[#EA601A] ml-0.5">*</span>
          </label>
          <div className="relative">
            <input
              id="ob-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              required
              autoComplete="new-password"
              className="w-full h-12 px-4 pr-12 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EA601A]/50 focus:border-[#EA601A]/50 transition-all hover:border-white/20"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              {eyeBtn(showPassword, () => setShowPassword(!showPassword))}
            </div>
          </div>
          <PasswordStrength password={password} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ob-confirm-password" className="block text-sm font-semibold text-white/70">
            Confirm Password<span className="text-[#EA601A] ml-0.5">*</span>
          </label>
          <div className="relative">
            <input
              id="ob-confirm-password"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
              className={`w-full h-12 px-4 pr-12 rounded-2xl bg-white/5 border text-white placeholder:text-white/20 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EA601A]/50 transition-all hover:border-white/20 ${
                confirmPassword && password !== confirmPassword
                  ? "border-red-500/50 focus:ring-red-500/30"
                  : confirmPassword && password === confirmPassword
                  ? "border-green-500/50 focus:ring-green-500/30"
                  : "border-white/10 focus:border-[#EA601A]/50"
              }`}
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              {eyeBtn(showConfirm, () => setShowConfirm(!showConfirm))}
            </div>
          </div>
        </div>

        {/* Terms */}
        <label className="flex items-start gap-3 cursor-pointer group pt-1">
          <div
            onClick={() => setTerms(!terms)}
            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
              terms ? "bg-[#EA601A] border-[#EA601A]" : "bg-white/5 border-white/15 group-hover:border-[#EA601A]/40"
            }`}
          >
            {terms && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </div>
          <span className="text-sm text-white/40 leading-relaxed">
            I agree to QuickServe&apos;s{" "}
            <a href="#" className="text-[#EA601A] hover:underline font-medium">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="text-[#EA601A] hover:underline font-medium">Privacy Policy</a>
          </span>
        </label>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-[#EA601A] to-[#ff8c42] hover:from-[#D45618] hover:to-[#EA601A] text-white font-bold text-base shadow-xl shadow-[#EA601A]/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2 group"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Creating account...</>
            ) : (
              <>Continue <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>
            )}
          </button>
        </div>

        <p className="text-center text-sm text-white/30 pt-1">
          Already have an account?{" "}
          <a href="/login" className="text-[#EA601A] hover:underline font-medium">Sign in</a>
        </p>
      </form>
    </div>
  )
}
