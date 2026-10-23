import { getAllCountries, getCountry, type Country as TimezoneCountry } from "countries-and-timezones"
import countryToCurrency from "country-to-currency"
import * as isoCountries from "i18n-iso-countries"
import enLocale from "i18n-iso-countries/langs/en.json"
import type { LocaleData } from "i18n-iso-countries"

export interface CountryMetadata {
  country: string
  countryCode: string
  currency: string
  timezone: string
  timezones: string[]
}

const currenciesByCountry = countryToCurrency as Record<string, string>

isoCountries.registerLocale(enLocale as LocaleData)

function toCountryMetadata(countryData: TimezoneCountry | null): CountryMetadata | null {
  if (!countryData?.id || !countryData.name) return null

  const alpha2 = countryData.id.toUpperCase()
  const currency = currenciesByCountry[alpha2]
  const timezones = countryData.timezones ?? []

  if (!currency || timezones.length === 0) return null

  return {
    country: isoCountries.getName(alpha2, "en") || countryData.name,
    countryCode: alpha2.toLowerCase(),
    currency,
    timezone: timezones[0],
    timezones,
  }
}

export function listCountryMetadata(): CountryMetadata[] {
  return Object.values(getAllCountries())
    .map(toCountryMetadata)
    .filter((country): country is CountryMetadata => Boolean(country))
    .sort((a, b) => a.country.localeCompare(b.country))
}

export function findCountryMetadata(value?: string | null): CountryMetadata | null {
  if (!value?.trim()) return null

  const normalized = value.trim().replace(/\s+/g, " ")
  const upper = normalized.toUpperCase()

  if (/^[A-Z]{2}$/.test(upper)) {
    return toCountryMetadata(getCountry(upper))
  }

  if (/^[A-Z]{3}$/.test(upper)) {
    const alpha2 = isoCountries.alpha3ToAlpha2(upper)
    if (alpha2) return toCountryMetadata(getCountry(alpha2))
  }

  const alpha2 =
    isoCountries.getAlpha2Code(normalized, "en") ||
    isoCountries.getSimpleAlpha2Code(normalized, "en")

  if (alpha2) return toCountryMetadata(getCountry(alpha2))

  const lower = normalized.toLowerCase()
  return listCountryMetadata().find((country) => country.country.toLowerCase() === lower) ?? null
}
