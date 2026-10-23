"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Globe2, Search } from "lucide-react"
import PhoneInput, {
  getCountryCallingCode,
  isSupportedCountry,
  type Country,
  type Value,
} from "react-phone-number-input/max"
import flags from "react-phone-number-input/flags"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface CountryOption {
  value?: Country
  label: string
  divider?: boolean
}

interface CountrySelectProps {
  value?: Country
  onChange: (country?: Country) => void
  options: CountryOption[]
  disabled?: boolean
  readOnly?: boolean
  name?: string
  "aria-label"?: string
}

interface InternationalPhoneInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  defaultCountry?: string
  disabled?: boolean
  invalid?: boolean
  ariaDescribedBy?: string
  onBlur?: () => void
}

function SearchableCountrySelect({
  value,
  onChange,
  options,
  disabled,
  readOnly,
  name,
  "aria-label": ariaLabel,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const countries = useMemo(
    () => options.filter((option): option is CountryOption & { value: Country } => Boolean(option.value && !option.divider)),
    [options]
  )
  const selectedCountry = countries.find((option) => option.value === value)
  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return countries

    return countries.filter((option) => {
      const callingCode = getCountryCallingCode(option.value)
      return option.label.toLowerCase().includes(normalizedQuery)
        || option.value.toLowerCase().includes(normalizedQuery)
        || `+${callingCode}`.includes(normalizedQuery)
    })
  }, [countries, query])
  const Flag = value ? flags[value] : undefined

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled || readOnly) return
        setOpen(nextOpen)
        if (!nextOpen) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          name={name}
          disabled={disabled || readOnly}
          aria-label={ariaLabel || "Select phone country"}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-full shrink-0 items-center gap-2 border-r border-white/10 px-3 text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {Flag ? (
            <span className="flex h-[14px] w-5 overflow-hidden rounded-[2px] ring-1 ring-white/10 [&_svg]:h-full [&_svg]:w-full">
              <Flag title={selectedCountry?.label || value || ""} />
            </span>
          ) : (
            <Globe2 className="h-4 w-4 text-white/40" aria-hidden="true" />
          )}
          <span className="text-xs font-semibold tabular-nums">
            {value ? `+${getCountryCallingCode(value)}` : "Code"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-white/30" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-white/10 bg-[#12111a] p-0 text-white shadow-2xl"
      >
        <div className="relative border-b border-white/10 p-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search country or code..."
            autoFocus
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#EA601A]/50 focus:ring-2 focus:ring-[#EA601A]/30"
          />
        </div>
        <div role="listbox" aria-label="Phone number country" className="max-h-64 overflow-y-auto p-1.5">
          {filteredCountries.length ? filteredCountries.map((option) => {
            const OptionFlag = flags[option.value]
            const isSelected = option.value === value

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                  setQuery("")
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/8",
                  isSelected ? "bg-[#EA601A]/10 text-[#EA601A]" : "text-white/70"
                )}
              >
                <span className="flex h-[14px] w-5 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-white/10 [&_svg]:h-full [&_svg]:w-full">
                  {OptionFlag && <OptionFlag title={option.label} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-white/35">
                  +{getCountryCallingCode(option.value)}
                </span>
              </button>
            )
          }) : (
            <p className="px-3 py-6 text-center text-sm text-white/35">No countries found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function resolveDefaultCountry(country?: string): Country | undefined {
  const normalizedCountry = country?.trim().toUpperCase()
  if (!normalizedCountry || !isSupportedCountry(normalizedCountry as Country)) return undefined
  return normalizedCountry as Country
}

export function InternationalPhoneInput({
  id,
  value,
  onChange,
  defaultCountry,
  disabled,
  invalid,
  ariaDescribedBy,
  onBlur,
}: InternationalPhoneInputProps) {
  return (
    <PhoneInput
      id={id}
      name="phoneNumber"
      value={value}
      onChange={(nextValue?: Value) => onChange(nextValue || "")}
      defaultCountry={resolveDefaultCountry(defaultCountry)}
      countrySelectComponent={SearchableCountrySelect}
      addInternationalOption={false}
      disabled={disabled}
      required
      autoComplete="tel"
      placeholder="Phone number"
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      onBlur={onBlur}
      className={cn(
        "flex h-12 w-full overflow-hidden rounded-2xl border bg-white/5 text-white transition-all hover:border-white/20 focus-within:ring-2",
        invalid
          ? "border-red-400/60 focus-within:border-red-400/70 focus-within:ring-red-400/20"
          : "border-white/10 focus-within:border-[#EA601A]/50 focus-within:ring-[#EA601A]/50"
      )}
      numberInputProps={{
        inputMode: "tel",
        className: "min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-white outline-none placeholder:text-white/20 disabled:cursor-not-allowed disabled:opacity-60",
      }}
    />
  )
}
