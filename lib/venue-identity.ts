export type VenueIdentityDisplay = {
  venueLabel?: string | null
  venueType?: string | null
  businessType?: string | null
}

function humanizeIdentifier(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function getVenueIdentityLabel(identity: VenueIdentityDisplay) {
  const canonicalLabel = identity.venueLabel?.trim()
  if (canonicalLabel) return canonicalLabel

  const fallbackIdentifier = identity.venueType || identity.businessType
  return fallbackIdentifier ? humanizeIdentifier(fallbackIdentifier) : "Business"
}
