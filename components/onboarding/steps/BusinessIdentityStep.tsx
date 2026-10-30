"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, Loader2, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2, XCircle } from "lucide-react"

import type { BusinessData } from "@/hooks/use-onboarding"
import { InternationalPhoneInput } from "@/components/onboarding/InternationalPhoneInput"
import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import { findCountryMetadata } from "@/lib/country-metadata"
import {
  fetchOnboardingVenueTypeCatalog,
  getOnboardingVenueTypeIds,
  type OnboardingVenueTypeCatalog,
} from "@/lib/onboarding-venue-types"
import {
  createBusinessIdentitySchema,
  getBusinessIdentityDefaultValues,
  slugifyBusinessName,
  toBusinessIdentityPayload,
  type BusinessIdentityFormValues,
} from "./BusinessIdentityStep.validation"

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
  const [venueCatalog, setVenueCatalog] = useState<OnboardingVenueTypeCatalog | null>(null)
  const [venueCatalogError, setVenueCatalogError] = useState<string | null>(null)
  const [venueCatalogLoading, setVenueCatalogLoading] = useState(true)
  const submissionInFlight = useRef(false)
  const phoneCountry = findCountryMetadata(initial?.countryCode || initial?.country)?.countryCode
  const supportedVenueTypeIds = useMemo(() => getOnboardingVenueTypeIds(venueCatalog), [venueCatalog])
  const validationSchema = useMemo(
    () => createBusinessIdentitySchema(supportedVenueTypeIds),
    [supportedVenueTypeIds],
  )
  const loadVenueCatalog = useCallback(async () => {
    setVenueCatalogLoading(true)
    setVenueCatalogError(null)
    try {
      setVenueCatalog(await fetchOnboardingVenueTypeCatalog())
    } catch (error) {
      setVenueCatalog(null)
      setVenueCatalogError(error instanceof Error ? error.message : "Business types could not be loaded. Try again.")
    } finally {
      setVenueCatalogLoading(false)
    }
  }, [])
  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<BusinessIdentityFormValues>({
    resolver: zodResolver(validationSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getBusinessIdentityDefaultValues(initial, ownerEmail),
  })
  const name = useWatch({ control, name: "name" })
  const slug = useWatch({ control, name: "slug" })
  const venueType = useWatch({ control, name: "venueType" })
  const isCatalogReady = !venueCatalogLoading && !venueCatalogError && supportedVenueTypeIds.length > 0
  const isPending = isLoading || isSubmitting

  useEffect(() => {
    void loadVenueCatalog()
  }, [loadVenueCatalog])

  useEffect(() => {
    if (venueType && isCatalogReady && !supportedVenueTypeIds.includes(venueType)) {
      setValue("venueType", "", { shouldDirty: true })
    }
  }, [isCatalogReady, setValue, supportedVenueTypeIds, venueType])

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
    if (!isCatalogReady || isLoading || submissionInFlight.current) return

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
        aria-busy={isPending || venueCatalogLoading}
      >
        <div>
          <p id="ob-venue-type-label" className="block text-sm font-semibold text-white/70 mb-1">
            What kind of business do you operate?<span className="text-[#EA601A] ml-0.5" aria-hidden="true">*</span>
          </p>
          <p className="mb-3 text-xs leading-relaxed text-white/35">
            Choose the type that best describes your business. Chillow will tailor your workspace accordingly.
          </p>
          {venueCatalogLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-white/45">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading available business types…
            </div>
          ) : venueCatalogError ? (
            <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              <p>{venueCatalogError}</p>
              <button type="button" onClick={() => void loadVenueCatalog()} className="mt-2 inline-flex items-center gap-1 font-semibold text-[#ff9b6b] hover:text-white">
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          ) : (
            <div className="space-y-3" role="radiogroup" aria-labelledby="ob-venue-type-label">
              {venueCatalog?.groups.map((group) => (
                <section key={group.id} aria-label={group.label}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/35">{group.label}</h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {group.venueTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        role="radio"
                        aria-checked={venueType === type.id}
                        onClick={() => {
                          setValue("venueType", type.id, { shouldDirty: true, shouldValidate: true })
                          setFormError(null)
                        }}
                        className={`min-h-12 rounded-2xl border px-3 py-2.5 text-left text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#EA601A]/60 ${
                          venueType === type.id
                            ? "border-[#EA601A]/60 bg-[#EA601A]/15 text-[#ff9b6b] shadow-lg shadow-[#EA601A]/10"
                            : "border-white/10 bg-white/3 text-white/60 hover:border-white/25 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          {errors.venueType?.message ? <p className="mt-2 text-xs text-red-300">{errors.venueType.message}</p> : null}
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
              <Field id="ob-slug" label="Your Chillow URL" required error={fieldState.error?.message} className={fieldClassName}>
                {(controlProps) => (
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 text-sm font-medium select-none pointer-events-none whitespace-nowrap">
                      chillow.io/
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
                  Preview: <span className="text-white/40 font-medium">chillow.io/{slug}</span>
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
            disabled={isPending || !isCatalogReady}
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
