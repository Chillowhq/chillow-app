import { apiClient } from "@/lib/axios-config"

export interface OnboardingVenueType {
  id: string
  label: string
  classificationGroup: string
  legacyBusinessType: string
  defaultModules: string[]
  onboardingAvailable: boolean
}

export interface OnboardingVenueTypeGroup {
  id: string
  label: string
  venueTypes: OnboardingVenueType[]
}

export interface OnboardingVenueTypeCatalog {
  version: number
  groups: OnboardingVenueTypeGroup[]
}

function isVenueType(value: unknown): value is OnboardingVenueType {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<OnboardingVenueType>
  return typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.classificationGroup === "string" &&
    typeof candidate.legacyBusinessType === "string" &&
    Array.isArray(candidate.defaultModules) &&
    typeof candidate.onboardingAvailable === "boolean"
}

function isVenueTypeCatalog(value: unknown): value is OnboardingVenueTypeCatalog {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<OnboardingVenueTypeCatalog>
  return typeof candidate.version === "number" &&
    Array.isArray(candidate.groups) &&
    candidate.groups.every((group) => (
      group &&
      typeof group.id === "string" &&
      typeof group.label === "string" &&
      Array.isArray(group.venueTypes) &&
      group.venueTypes.every(isVenueType)
    ))
}

export async function fetchOnboardingVenueTypeCatalog(): Promise<OnboardingVenueTypeCatalog> {
  const response = await apiClient.get<unknown>("/onboarding/venue-types")
  if (!isVenueTypeCatalog(response.data)) {
    throw new Error("The available business types could not be loaded.")
  }

  const groups = response.data.groups
    .map((group) => ({
      ...group,
      venueTypes: group.venueTypes.filter((venueType) => venueType.onboardingAvailable),
    }))
    .filter((group) => group.venueTypes.length > 0)

  if (groups.length === 0) {
    throw new Error("No business types are currently available for onboarding.")
  }

  return { ...response.data, groups }
}

export function getOnboardingVenueTypeIds(catalog: OnboardingVenueTypeCatalog | null): string[] {
  return catalog?.groups.flatMap((group) => group.venueTypes.map((venueType) => venueType.id)) ?? []
}
