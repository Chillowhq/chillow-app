"use client"

import { useEffect, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, Loader2, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2, XCircle } from "lucide-react"

import type { BusinessData } from "@/hooks/use-onboarding"
import { InternationalPhoneInput } from "@/components/onboarding/InternationalPhoneInput"
import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import { findCountryMetadata } from "@/lib/country-metadata"
import {
  businessIdentitySchema,
  getBusinessIdentityDefaultValues,
  slugifyBusinessName,
  toBusinessIdentityPayload,
  type BusinessIdentityFormValues,
} from "./BusinessIdentityStep.validation"

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant", emoji: "Ã°Å¸ÂÂ½Ã¯Â¸Â" },
  { value: "bar_lounge", label: "Bar & Lounge", emoji: "Ã°Å¸ÂÂ¸" },
  { value: "hotel", label: "Hotel / Apartment", emoji: "Ã°Å¸ÂÂ¨" },
]

const fieldClassName = "space-y-1.5 [&_label]:block [&_label]:text-sm [&_label]:font-semibold [&_label]:text-white/70"
const inputClassName = "w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EA601A]/50 focus:border-[#EA601A]/50 transition-all hover:border-white/20"

interface Props {
  initial?: Partial<BusinessData>
  ownerEmail?: string
  onComplete: (data: BusinessData) => Promise<{ success: boolean; message?: string }>
  onBack: () => void
  isLoading: boolean
}

type SlugStatus = "idle" | "checking" | "available" | "taken"

export function BusinessIdentityStep({ initial, ownerEmail, onComplete, onBack, isLoading }: Props) {
  const [slugManual, setSlugManual] = useState(false)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle")
  const [formError, setFormError] = useState<string | null>(null)
  const submissionInFlight = useRef(false)
  const phoneCountry = findCountryMetadata(initial?.countryCode || initial?.country)?.countryCode
  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<BusinessIdentityFormValues>({
    resolver: zodResolver(businessIdentitySchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getBusinessIdentityDefaultValues(initial, ownerEmail),
  })
  const name = useWatch({ control, name: "name" })
  const slug = useWatch({ control, name: "slug" })
  const businessType = useWatch({ control, name: "businessType" })
  const isPending = isLoading || isSubmitting

  useEffect(() => {
    if (!slugManual && name) {
      setValue("slug", slugifyBusinessName(name))
    }
  }, [name, setValue, slugManual])

  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugStatus("idle")
      return
    }
    setSlugStatus("checking")
    const timer = setTimeout(async () => {
      try {
        setSlugStatus("available")
      } catch {
        setSlugStatus("idle")
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [slug])

  const handleBusinessIdentitySubmit = async (values: BusinessIdentityFormValues) => {
    if (isLoading || submissionInFlight.current) return

    submissionInFlight.current = true
    setFormError(null)

    try {
      const result = await onComplete(toBusinessIdentityPayload(values))
      if (!result.success) {
        setFormError(result.message || "Failed to save business identity")
      }
    } finally {
      submissionInFlight.current = false
    }
  }

  const slugStatusIcon = () => {
    if (slugStatus === "checking") return <RefreshCw className="w-4 h-4 text-white/30 animate-spin" />
    if (slugStatus === "available") return <CheckCircle2 className="w-4 h-4 text-green-400" />
    if (slugStatus === "taken") return <XCircle className="w-4 h-4 text-red-400" />
    return null
  }

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
          <Building2 className="w-6 h-6 text-violet-400" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Business Identity</h1>
        <p className="text-white/40 text-sm leading-relaxed">
          Tell us about your business. This information will be displayed to your customers.
        </p>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(handleBusinessIdentitySubmit)(event)}
        className="space-y-4"
        noValidate
        aria-busy={isPending}
      >
        <div>
          <p id="ob-business-type-label" className="block text-sm font-semibold text-white/70 mb-2">
            Business Type<span className="text-[#EA601A] ml-0.5" aria-hidden="true">*</span>
          </p>
          <div role="group" aria-labelledby="ob-business-type-label" className="grid grid-cols-3 gap-2">
            {BUSINESS_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={businessType === type.value}
                onClick={() => {
                  setValue("businessType", type.value, { shouldDirty: true })
                  setFormError(null)
                }}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border text-center transition-all ${
                  businessType === type.value
                    ? "bg-[#EA601A]/15 border-[#EA601A]/50 shadow-lg shadow-[#EA601A]/10"
                    : "bg-white/3 border-white/8 hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <span className="text-xl">{type.emoji}</span>
                <span className={`text-xs font-bold leading-tight ${businessType === type.value ? "text-[#EA601A]" : "text-white/50"}`}>
                  {type.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Field id="ob-biz-name" label="Business Name" required error={errors.name?.message} className={fieldClassName}>
          {(controlProps) => (
            <input
              {...register("name", { onChange: () => setFormError(null) })}
              {...controlProps}
              type="text"
              placeholder="e.g. The Golden Fork"
              required
              className={inputClassName}
            />
          )}
        </Field>

        <Field
          id="ob-display-name"
          label={<><span>Display Name</span> <span className="text-white/25 font-normal text-xs">(optional Ã¢â‚¬â€ defaults to business name)</span></>}
          error={errors.displayName?.message}
          className={fieldClassName}
        >
          {(controlProps) => (
            <input
              {...register("displayName", { onChange: () => setFormError(null) })}
              {...controlProps}
              type="text"
              placeholder="e.g. Golden Fork Restaurant"
              className={inputClassName}
            />
          )}
        </Field>

        <Controller
          control={control}
          name="slug"
          render={({ field, fieldState }) => (
            <>
              <Field id="ob-slug" label="Your QuickServe URL" required error={fieldState.error?.message} className={fieldClassName}>
                {(controlProps) => (
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 text-sm font-medium select-none pointer-events-none whitespace-nowrap">
                      quickserve.com/
                    </div>
                    <input
                      {...field}
                      {...controlProps}
                      type="text"
                      onChange={(event) => {
                        setSlugManual(true)
                        field.onChange(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40))
                        setFormError(null)
                      }}
                      placeholder="your-restaurant"
                      minLength={3}
                      maxLength={40}
                      required
                      className={`${inputClassName} pl-36 pr-10`}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {slugStatusIcon()}
                    </div>
                  </div>
                )}
              </Field>
              {slug && (
                <p className="text-xs text-white/25 pl-1">
                  Preview: <span className="text-white/40 font-medium">quickserve.com/{slug}</span>
                </p>
              )}
              {slugManual && (
                <button
                  type="button"
                  onClick={() => {
                    setSlugManual(false)
                    setValue("slug", slugifyBusinessName(name))
                    setFormError(null)
                  }}
                  className="text-xs text-[#EA601A]/70 hover:text-[#EA601A] flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Auto-generate from name
                </button>
              )}
            </>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field id="ob-contact-email" label="Contact Email" required error={errors.contactEmail?.message} className={`min-w-0 ${fieldClassName}`}>
            {(controlProps) => (
              <input
                {...register("contactEmail", { onChange: () => setFormError(null) })}
                {...controlProps}
                type="email"
                placeholder="info@restaurant.com"
                required
                className={inputClassName}
              />
            )}
          </Field>
          <Controller
            control={control}
            name="phoneNumber"
            render={({ field, fieldState }) => (
              <Field id="ob-phone" label="Phone Number" required error={fieldState.error?.message} className={`min-w-0 ${fieldClassName}`}>
                {(controlProps) => (
                  <InternationalPhoneInput
                    id={controlProps.id}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                      setFormError(null)
                    }}
                    defaultCountry={phoneCountry}
                    disabled={isLoading}
                    invalid={Boolean(controlProps["aria-invalid"])}
                    ariaDescribedBy={controlProps["aria-describedby"]}
                    onBlur={() => {
                      field.onBlur()
                      if (field.value) void trigger("phoneNumber")
                    }}
                  />
                )}
              </Field>
            )}
          />
        </div>

        {formError ? <FormNotice>{formError}</FormNotice> : null}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="h-13 py-3.5 px-6 rounded-2xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 font-bold text-sm transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 h-13 py-3.5 rounded-2xl bg-gradient-to-r from-[#EA601A] to-[#ff8c42] hover:from-[#D45618] hover:to-[#EA601A] text-white font-bold text-base shadow-xl shadow-[#EA601A]/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2 group"
          >
            {isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : (
              <>Continue <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
