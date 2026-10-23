export type PropertyPhoto = {
  id: string
  url: string
  publicId: string
}

export type PropertyProfileCompletenessItem = {
  id: string
  label: string
  category: "required" | "recommended"
  complete: boolean
}

export type PropertyProfileCompleteness = {
  percentage: number
  completedCount: number
  totalCount: number
  requiredComplete: boolean
  checklist: PropertyProfileCompletenessItem[]
}

export type DiscoveryPublication = {
  discoveryPublished: boolean
  publishedAt: string | null
  eligibility: {
    eligible: boolean
    blockers: Array<{ code: string; message: string }>
  }
  effectivePublic: boolean
}

export type CatalogItem = { id: string; label: string }

export type PropertyProfileCatalog = {
  accommodationTypes: CatalogItem[]
  facilityGroups: Array<{
    id: string
    label: string
    facilities: CatalogItem[]
  }>
  languages: CatalogItem[]
  // F&B catalogs (present for restaurants/bars)
  diningStyles?: CatalogItem[]
  cuisineTypes?: CatalogItem[]
  mealServices?: CatalogItem[]
  atmosphereTags?: CatalogItem[]
  restaurantFacilityGroups?: Array<{
    id: string
    label: string
    facilities: CatalogItem[]
  }>
  barHighlights?: CatalogItem[]
  dietaryOptions?: CatalogItem[]
  accessibilityFeatures?: CatalogItem[]
  dressCodes?: CatalogItem[]
  reservationPolicies?: CatalogItem[]
}

export type SocialLinks = {
  instagram: string
  facebook: string
}

export type PropertyProfileResponse = {
  businessId: string
  businessType: string
  details: {
    propertyName: string
    description: string
    // Hotel-specific
    accommodationType?: string | null
    starRating?: number | null
    // Restaurant/Bar-specific
    tagline?: string
    priceLevel?: number | null
    diningStyle?: string | null
  }
  location: {
    address: string
    city: string
    region: string
    postalCode: string
    country: string
    countryCode: string
    verified: boolean
    latitude: number | null
    longitude: number | null
  }
  photos: PropertyPhoto[]
  facilities: {
    facilityIds: string[]
    parking: {
      available: boolean | null
      cost: "free" | "paid" | null
      reservation: "required" | "not_required" | null
      location: "onsite" | "offsite" | null
      access: "private" | "public" | null
    }
    breakfastOffered?: boolean | null
    barHighlights?: string[]
  }
  languages: string[]
  // Hotel-specific
  arrivalDeparture?: {
    checkInFrom: string
    checkInUntil: string
    checkOutFrom: string
    checkOutUntil: string
    timezone: string
  }
  // Restaurant/Bar-specific
  cuisine?: {
    cuisineTypes: string[]
    mealServices: string[]
  }
  atmosphere?: {
    atmosphere: string[]
    dressCode: string | null
  }
  dietaryAccessibility?: {
    dietaryOptions: string[]
    accessibility: string[]
  }
  policies: {
    childrenAllowed: boolean | null
    petsPolicy: "allowed" | "on_request" | "not_allowed" | null
    reservationPolicy?: string | null
  }
  contact: {
    phone: string
    email: string
    website: string
    socialLinks?: SocialLinks
  }
  discoveryPublication: DiscoveryPublication
  completeness: PropertyProfileCompleteness
  catalogs: PropertyProfileCatalog
  updatedAt: string | null
  savedSection?: string
}
