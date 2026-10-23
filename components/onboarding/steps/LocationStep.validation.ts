import { z } from "zod"

import type { BusinessData } from "@/hooks/use-onboarding"
import { findCountryMetadata, type CountryMetadata } from "@/lib/country-metadata"

export const locationSchema = z.object({
  country: z.string().trim().min(1, "Country is required"),
  address: z.string().trim().min(1, "Business address is required"),
  timezone: z.string().trim().min(1, "Timezone is required"),
  language: z.string().trim().min(1, "Language is required"),
})

export type LocationFormValues = z.infer<typeof locationSchema>

export function getLocationDefaultValues(initial?: Partial<BusinessData>): LocationFormValues {
  const initialCountry = findCountryMetadata(initial?.countryCode || initial?.country)

  return {
    country: initialCountry?.country ?? initial?.country ?? "",
    address: initial?.address ?? "",
    timezone: initial?.timezone ?? initialCountry?.timezone ?? "UTC",
    language: initial?.language ?? "en",
  }
}

export function toLocationPayload({
  values,
  selectedCountry,
  addressPlaceId,
  addressSessionToken,
  initial,
}: {
  values: LocationFormValues
  selectedCountry: CountryMetadata
  addressPlaceId: string
  addressSessionToken: string
  initial?: Partial<BusinessData>
}): BusinessData {
  const timezone = selectedCountry.timezones.includes(values.timezone)
    ? values.timezone
    : selectedCountry.timezone

  return {
    country: selectedCountry.country,
    countryCode: selectedCountry.countryCode,
    address: values.address.trim(),
    addressPlaceId,
    addressSessionToken: addressSessionToken || undefined,
    latitude: initial?.latitude,
    longitude: initial?.longitude,
    currency: selectedCountry.currency,
    timezone,
    language: values.language,
  }
}
