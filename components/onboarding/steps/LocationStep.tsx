"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useController, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MapPin, Loader2, ArrowRight, ArrowLeft, Search, CheckCircle2 } from "lucide-react"

import type { BusinessData } from "@/hooks/use-onboarding"
import { findCountryMetadata, listCountryMetadata, type CountryMetadata } from "@/lib/country-metadata"
import { apiClient } from "@/lib/axios-config"
import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import {
  getLocationDefaultValues,
  locationSchema,
  toLocationPayload,
  type LocationFormValues,
} from "./LocationStep.validation"

interface Props {
  sessionId: string
  initial?: Partial<BusinessData>
  onComplete: (data: BusinessData) => Promise<{ success: boolean; message?: string }>
  onBack: () => void
  isLoading: boolean
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "ar", label: "Arabic" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
]

interface AddressSuggestion {
  placeId: string
  text: string
  mainText?: string
  secondaryText?: string
}

const fieldClassName = "space-y-1.5 [&_label]:block [&_label]:text-sm [&_label]:font-semibold [&_label]:text-white/70"
const selectClassName = "w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EA601A]/50 focus:border-[#EA601A]/50 transition-all hover:border-white/20 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
const selectBackgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")"

function CountryFlag({ countryCode, country }: { countryCode?: string; country?: string }) {
  const code = (countryCode || "").trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return <span className="h-[14px] w-5 shrink-0" />

  const imageCode = code.toLowerCase()

  return (
    <img
      src={`https://flagcdn.com/24x18/${imageCode}.png`}
      srcSet={`https://flagcdn.com/48x36/${imageCode}.png 2x`}
      alt={country ? `${country} flag` : ""}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="block h-[14px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-white/10"
    />
  )
}

export function LocationStep({ sessionId, initial, onComplete, onBack, isLoading }: Props) {
  const countryOptions = useMemo(() => listCountryMetadata(), [])
  const initialCountry = findCountryMetadata(initial?.countryCode || initial?.country)
  const [addressPlaceId, setAddressPlaceId] = useState(initial?.addressPlaceId ?? "")
  const [addressSessionToken, setAddressSessionToken] = useState("")
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [addressProviderError, setAddressProviderError] = useState<string | null>(null)
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const placesSessionTokenRef = useRef("")
  const [currency, setCurrency] = useState(initial?.currency ?? initialCountry?.currency ?? "USD")
  const [countrySearch, setCountrySearch] = useState("")
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const submissionInFlight = useRef(false)
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getLocationDefaultValues(initial),
  })
  const { field: countryField, fieldState: countryFieldState } = useController({ control, name: "country" })
  const country = countryField.value
  const address = useWatch({ control, name: "address" })
  const timezone = useWatch({ control, name: "timezone" })
  const language = useWatch({ control, name: "language" })
  const isPending = isLoading || isSubmitting
  const addressField = register("address", {
    onChange: () => {
      setAddressPlaceId("")
      setAddressSessionToken("")
      setAddressProviderError(null)
      setShowAddressSuggestions(true)
      clearErrors("address")
      setFormError(null)
    },
  })
  const languageField = register("language", { onChange: () => setFormError(null) })
  const timezoneField = register("timezone", { onChange: () => setFormError(null) })

  const selectedCountry = useMemo(() => {
    return (
      countryOptions.find((option) => option.country === country) ??
      findCountryMetadata(country)
    )
  }, [country, countryOptions])

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase()
    if (!query) return countryOptions

    return countryOptions.filter((option) =>
      option.country.toLowerCase().includes(query) ||
      option.countryCode.includes(query)
    )
  }, [countryOptions, countrySearch])

  const timezoneOptions = useMemo(() => {
    if (selectedCountry?.timezones.length) return selectedCountry.timezones
    return timezone ? [timezone] : ["UTC"]
  }, [selectedCountry, timezone])

  useEffect(() => {
    if (!selectedCountry) return

    if (country !== selectedCountry.country) {
      countryField.onChange(selectedCountry.country)
    }
    setCurrency(selectedCountry.currency)
    if (!selectedCountry.timezones.includes(timezone)) {
      setValue("timezone", selectedCountry.timezone)
    }
  }, [country, countryField, selectedCountry, setValue, timezone])

  useEffect(() => {
    const query = address.trim()
    const countryCode = selectedCountry?.countryCode
    if (addressPlaceId || query.length < 3 || !countryCode) {
      setAddressSuggestions([])
      setIsSearchingAddress(false)
      return
    }

    if (!placesSessionTokenRef.current) {
      placesSessionTokenRef.current = crypto.randomUUID()
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsSearchingAddress(true)
      try {
        const response = await apiClient.get(`/onboarding/session/${sessionId}/address-suggestions`, {
          params: {
            input: query,
            countryCode,
            sessionToken: placesSessionTokenRef.current,
          },
          signal: controller.signal,
        })
        setAddressSuggestions(response.data.suggestions ?? [])
        setShowAddressSuggestions(true)
      } catch (error: any) {
        if (error?.code === "ERR_CANCELED") return
        setAddressSuggestions([])
        setShowAddressSuggestions(false)
        setAddressProviderError(error.response?.data?.message || "Address search is temporarily unavailable")
      } finally {
        if (!controller.signal.aborted) setIsSearchingAddress(false)
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [address, addressPlaceId, selectedCountry?.countryCode, sessionId])

  const handleCountrySelect = (option: CountryMetadata) => {
    if (selectedCountry?.countryCode !== option.countryCode) {
      setValue("address", "")
      setAddressPlaceId("")
      setAddressSessionToken("")
      setAddressSuggestions([])
      setAddressProviderError(null)
      setShowAddressSuggestions(false)
      placesSessionTokenRef.current = ""
    }
    countryField.onChange(option.country)
    setCurrency(option.currency)
    setValue("timezone", option.timezone, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
    setCountrySearch("")
    setShowCountryDropdown(false)
    clearErrors(["country", "address"])
    setFormError(null)
  }

  const handleLocationSubmit = async (values: LocationFormValues) => {
    if (isLoading || submissionInFlight.current) return

    if (!selectedCountry) {
      setError("country", { type: "validate", message: "Please select a valid country" }, { shouldFocus: true })
      return
    }

    if (!addressPlaceId) {
      setAddressProviderError("Select a valid address from the suggestions")
      return
    }

    submissionInFlight.current = true
    setFormError(null)

    try {
      const result = await onComplete(toLocationPayload({
        values,
        selectedCountry,
        addressPlaceId,
        addressSessionToken,
        initial,
      }))

      if (!result.success) {
        setFormError(result.message || "Failed to save location")
      }
    } finally {
      submissionInFlight.current = false
    }
  }

  const SelectField = ({
    id, label, value, onChange, options, required, disabled,
  }: {
    id: string; label: string; value: string
    onChange: (value: string) => void; options: { value: string; label: string }[]
    required?: boolean; disabled?: boolean
  }) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-white/70">
        {label}{required && <span className="text-[#EA601A] ml-0.5">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        className={selectClassName}
        style={{ backgroundImage: selectBackgroundImage, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#1a1224] text-white">{option.label}</option>
        ))}
      </select>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <MapPin className="w-6 h-6 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Location & Localization</h1>
        <p className="text-white/40 text-sm leading-relaxed">
          Set your business location and regional preferences. These affect currency, timezone, and language settings.
        </p>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(handleLocationSubmit)(event)}
        className="space-y-4"
        noValidate
        aria-busy={isPending}
      >
        <Field id="ob-country" label="Country" required error={countryFieldState.error?.message} className={`relative ${fieldClassName}`}>
          {(controlProps) => (
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                {!showCountryDropdown && selectedCountry ? (
                  <CountryFlag countryCode={selectedCountry.countryCode} country={selectedCountry.country} />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </div>
              <input
                type="text"
                {...countryField}
                {...controlProps}
                value={showCountryDropdown ? countrySearch : country}
                onChange={(event) => {
                  setCountrySearch(event.target.value)
                  setShowCountryDropdown(true)
                }}
                onFocus={() => {
                  setCountrySearch("")
                  setShowCountryDropdown(true)
                }}
                placeholder="Search country..."
                required
                className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EA601A]/50 focus:border-[#EA601A]/50 transition-all hover:border-white/20"
              />
              {showCountryDropdown && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#1a1224] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                  {filteredCountries.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-white/30">No countries found</p>
                  ) : (
                    filteredCountries.map((option) => (
                      <button
                        key={option.countryCode}
                        type="button"
                        onClick={() => handleCountrySelect(option)}
                        className={`w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-white/5 transition-colors flex items-center justify-between gap-3 ${
                          selectedCountry?.countryCode === option.countryCode ? "text-[#EA601A] bg-[#EA601A]/5" : "text-white/70"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <CountryFlag countryCode={option.countryCode} country={option.country} />
                          <span className="truncate">{option.country}</span>
                        </span>
                        <span className="text-[11px] uppercase text-white/30 shrink-0">{option.countryCode}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {showCountryDropdown && (
                <div className="fixed inset-0 z-40" onClick={() => setShowCountryDropdown(false)} />
              )}
            </div>
          )}
        </Field>

        <Field
          id="ob-address"
          label="Business Address"
          required
          error={errors.address?.message || addressProviderError}
          className={`relative z-30 ${fieldClassName}`}
        >
          {(controlProps) => (
            <>
              <div className="relative z-50">
              <input
                type="text"
                {...addressField}
                {...controlProps}
                value={address}
                onFocus={() => addressSuggestions.length && setShowAddressSuggestions(true)}
                placeholder="Start typing your business address..."
                autoComplete="off"
                required
                className={`w-full h-12 pl-4 pr-11 rounded-2xl bg-white/5 border text-white placeholder:text-white/20 text-sm font-medium focus:outline-none focus:ring-2 transition-all hover:border-white/20 ${
                  errors.address || addressProviderError
                    ? "border-red-400/60 focus:ring-red-400/20 focus:border-red-400/70"
                    : addressPlaceId
                      ? "border-emerald-400/40 focus:ring-emerald-400/20 focus:border-emerald-400/60"
                      : "border-white/10 focus:ring-[#EA601A]/50 focus:border-[#EA601A]/50"
                }`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isSearchingAddress ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white/30" />
                ) : addressPlaceId ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Search className="w-4 h-4 text-white/25" />
                )}
              </div>

              {showAddressSuggestions && !addressPlaceId && address.trim().length >= 3 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#1a1224] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="max-h-56 overflow-y-auto p-1.5">
                    {isSearchingAddress ? (
                      <p className="px-3 py-3 text-sm text-white/35">Searching addresses...</p>
                    ) : addressSuggestions.length ? (
                      addressSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.placeId}
                          type="button"
                          onClick={() => {
                            setValue("address", suggestion.text, { shouldValidate: true })
                            setAddressPlaceId(suggestion.placeId)
                            setAddressSessionToken(placesSessionTokenRef.current)
                            setAddressProviderError(null)
                            setAddressSuggestions([])
                            setShowAddressSuggestions(false)
                            placesSessionTokenRef.current = ""
                          }}
                          className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                        >
                          <span className="block truncate text-sm font-medium text-white/75">
                            {suggestion.mainText || suggestion.text}
                          </span>
                          {suggestion.secondaryText && (
                            <span className="mt-0.5 block truncate text-xs text-white/35">
                              {suggestion.secondaryText}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-white/35">No matching addresses found</p>
                    )}
                  </div>
                  <div className="border-t border-white/8 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-white/50">
                    Google Maps
                  </div>
                </div>
              )}
              </div>
              {showAddressSuggestions && (
                <div className="fixed inset-0 z-40" onClick={() => setShowAddressSuggestions(false)} />
              )}
            </>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            id="ob-currency"
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={[{ value: currency, label: currency }]}
            required
            disabled
          />
          <Field id="ob-language" label="Language" required error={errors.language?.message} className={`min-w-0 ${fieldClassName}`}>
            {(controlProps) => (
              <select
                {...languageField}
                {...controlProps}
                value={language}
                required
                className={selectClassName}
                style={{ backgroundImage: selectBackgroundImage, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
              >
                {LANGUAGES.map((option) => (
                  <option key={option.code} value={option.code} className="bg-[#1a1224] text-white">{option.label}</option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field id="ob-timezone" label="Timezone" required error={errors.timezone?.message} className={fieldClassName}>
          {(controlProps) => (
            <select
              {...timezoneField}
              {...controlProps}
              value={timezone}
              required
              className={selectClassName}
              style={{ backgroundImage: selectBackgroundImage, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
            >
              {timezoneOptions.map((option) => (
                <option key={option} value={option} className="bg-[#1a1224] text-white">{option.replace(/_/g, " ")}</option>
              ))}
            </select>
          )}
        </Field>

        {selectedCountry && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
            <p className="text-xs text-emerald-300/70">
              Currency and timezone auto-filled based on your selected country.
            </p>
          </div>
        )}

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
