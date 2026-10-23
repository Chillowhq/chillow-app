"use client"

import { CheckCircle2, Loader2, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiClient } from "@/lib/axios-config"
import { findCountryMetadata, listCountryMetadata } from "@/lib/country-metadata"

export type GoogleAddressSelection = {
  address: string
  placeId: string
  sessionToken: string
  country: string
  countryCode: string
}

type AddressSuggestion = {
  placeId: string
  text: string
  mainText?: string
  secondaryText?: string
}

type GoogleAddressSelectorProps = {
  address: string
  countryCode: string
  disabled?: boolean
  onSelect: (selection: GoogleAddressSelection) => void
  onClearSelection: () => void
}

export function GoogleAddressSelector({
  address,
  countryCode,
  disabled = false,
  onSelect,
  onClearSelection,
}: GoogleAddressSelectorProps) {
  const countries = useMemo(() => listCountryMetadata(), [])
  const [selectedCountryCode, setSelectedCountryCode] = useState(countryCode)
  const [query, setQuery] = useState(address)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [providerError, setProviderError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearchEnabled, setIsSearchEnabled] = useState(false)
  const placesSessionTokenRef = useRef("")

  useEffect(() => {
    setSelectedCountryCode(countryCode)
    setQuery(address)
    setSuggestions([])
    setProviderError(null)
    setShowSuggestions(false)
    setIsSearchEnabled(false)
    placesSessionTokenRef.current = ""
  }, [address, countryCode])

  const selectedCountry = useMemo(
    () => countries.find((country) => country.countryCode === selectedCountryCode)
      ?? findCountryMetadata(selectedCountryCode),
    [countries, selectedCountryCode],
  )

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (disabled || !isSearchEnabled || trimmedQuery.length < 3 || !selectedCountry) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    if (!placesSessionTokenRef.current) {
      placesSessionTokenRef.current = crypto.randomUUID()
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await apiClient.get<{ suggestions?: AddressSuggestion[] }>(
          "/business/property-profile/address-suggestions",
          {
            params: {
              input: trimmedQuery,
              countryCode: selectedCountry.countryCode,
              sessionToken: placesSessionTokenRef.current,
            },
            signal: controller.signal,
          },
        )
        setSuggestions(response.data.suggestions ?? [])
        setShowSuggestions(true)
      } catch (error: any) {
        if (error?.code === "ERR_CANCELED") return
        setSuggestions([])
        setShowSuggestions(false)
        setProviderError(error.response?.data?.message || "Address search is temporarily unavailable")
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [disabled, isSearchEnabled, query, selectedCountry])

  const handleCountryChange = (nextCountryCode: string) => {
    setSelectedCountryCode(nextCountryCode)
    setQuery("")
    setSuggestions([])
    setProviderError(null)
    setShowSuggestions(false)
    setIsSearchEnabled(false)
    placesSessionTokenRef.current = ""
    onClearSelection()
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="property-country" className="mb-2 block text-sm font-bold text-foreground">Country</label>
          <Select value={selectedCountryCode || undefined} onValueChange={handleCountryChange} disabled={disabled}>
            <SelectTrigger id="property-country" className="h-11 rounded-xl bg-background"><SelectValue placeholder="Choose country" /></SelectTrigger>
            <SelectContent className="max-h-72 overflow-y-auto">
              {countries.map((country) => <SelectItem key={country.countryCode} value={country.countryCode}>{country.country}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative">
        <label htmlFor="property-address-search" className="mb-2 block text-sm font-bold text-foreground">Business address</label>
        <div className="relative">
          <Input
            id="property-address-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setProviderError(null)
              setShowSuggestions(true)
              setIsSearchEnabled(true)
              onClearSelection()
            }}
            onFocus={() => suggestions.length && setShowSuggestions(true)}
            placeholder="Start typing the business address..."
            autoComplete="off"
            disabled={disabled}
            aria-autocomplete="list"
            aria-expanded={showSuggestions && !disabled}
            aria-controls="property-address-suggestions"
            className="h-11 rounded-xl border-border bg-background px-3 pr-10 font-medium"
          />
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Search className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        {providerError ? <p role="alert" className="mt-2 text-sm font-medium text-destructive">{providerError}</p> : null}

        {showSuggestions && !disabled && query.trim().length >= 3 ? (
          <div id="property-address-suggestions" role="listbox" className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-xl">
            <div className="max-h-56 overflow-y-auto">
              {isSearching ? <p className="px-3 py-3 text-sm text-muted-foreground">Searching addresses...</p> : null}
              {!isSearching && suggestions.length ? suggestions.map((suggestion) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() => {
                    if (!selectedCountry || !placesSessionTokenRef.current) return
                    setQuery(suggestion.text)
                    setSuggestions([])
                    setShowSuggestions(false)
                    setProviderError(null)
                    setIsSearchEnabled(false)
                    onSelect({
                      address: suggestion.text,
                      placeId: suggestion.placeId,
                      sessionToken: placesSessionTokenRef.current,
                      country: selectedCountry.country,
                      countryCode: selectedCountry.countryCode,
                    })
                    placesSessionTokenRef.current = ""
                  }}
                >
                  <span className="block truncate text-sm font-medium">{suggestion.mainText || suggestion.text}</span>
                  {suggestion.secondaryText ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{suggestion.secondaryText}</span> : null}
                </button>
              )) : null}
              {!isSearching && !suggestions.length ? <p className="px-3 py-3 text-sm text-muted-foreground">No matching addresses found</p> : null}
            </div>
            <p className="border-t border-border px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-muted-foreground">Google Maps</p>
          </div>
        ) : null}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
        Select an address from Google Maps. Chillow saves Google&apos;s formatted address and map coordinates for Discovery.
      </p>
    </div>
  )
}
