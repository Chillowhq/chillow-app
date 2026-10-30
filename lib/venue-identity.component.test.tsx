import { describe, expect, it } from "vitest"

import { getVenueIdentityLabel } from "./venue-identity"

describe("getVenueIdentityLabel", () => {
  it("prefers the backend canonical venue label", () => {
    expect(getVenueIdentityLabel({
      venueLabel: "Café",
      venueType: "cafe",
      businessType: "restaurant",
    })).toBe("Café")
  })

  it("keeps legacy businesses readable without inventing a venue type", () => {
    expect(getVenueIdentityLabel({ businessType: "bar_lounge" })).toBe("Bar Lounge")
  })
})
