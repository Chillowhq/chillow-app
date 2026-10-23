import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [legacyPage, profile, section, settings, layout, types, permissions, addressSelector] = await Promise.all([
  readFile(new URL("./app/owner/property-profile/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("./components/property-profile/PropertyProfileSettings.tsx", import.meta.url), "utf8"),
  readFile(new URL("./components/property-profile/PropertyProfileSection.tsx", import.meta.url), "utf8"),
  readFile(new URL("./app/owner/settings/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("./app/owner/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("./types/property-profile.ts", import.meta.url), "utf8"),
  readFile(new URL("./lib/manager-permissions.ts", import.meta.url), "utf8"),
  readFile(new URL("./components/property-profile/GoogleAddressSelector.tsx", import.meta.url), "utf8"),
])

test("Property Profile tab is accessible to supported shells using the existing access boundary", () => {
  assert.match(profile, /allowedRoles: MANAGEMENT_ROLES/)
  assert.match(profile, /requiredArea: MANAGEMENT_ACCESS_AREAS\.BUSINESS_SETTINGS/)
  assert.match(settings, /user\.capabilities\.identity\.shell === "hotel"/)
  assert.match(settings, /capabilitySections\?\.includes\("propertyProfile"\)/)
  assert.match(settings, /user\.capabilities\.visibleModules\.includes\("lodging"\)/)
  assert.match(settings, /\{ id: "business", label: "Business Info"[\s\S]*\{ id: "property-profile", label: "Property Profile"[\s\S]*\{ id: "operations", label: "Operations"/)
  assert.match(settings, /tab\.id === "property-profile"[\s\S]*hasBusinessProfile && !isManager/)
  assert.doesNotMatch(settings, /tab\.id !== "preferences"/)
  assert.match(settings, /propertyProfileMounted[\s\S]*hidden=\{activeTab !== "property-profile"\}[\s\S]*<PropertyProfileSettings \/>/)
  assert.doesNotMatch(layout, /propertyProfile: \{ href: "\/owner\/property-profile"/)
  assert.match(permissions, /pathname\.startsWith\("\/owner\/property-profile"\)[\s\S]+BUSINESS_SETTINGS/)
})

test("the legacy route redirects to the addressable Property Profile Settings tab", () => {
  assert.match(legacyPage, /router\.replace\("\/owner\/settings\?tab=property-profile"\)/)
  assert.match(settings, /new URLSearchParams\(window\.location\.search\)\.get\("tab"\)/)
  assert.match(settings, /setActiveTab\("property-profile"\)/)
})

test("Settings keeps neutral copy and separates global save from section saves", () => {
  assert.match(settings, /Manage your business information, operations and preferences\./)
  assert.match(settings, /activeTab !== "property-profile"/)
  assert.match(settings, /setPropertyProfileMounted\(true\)/)
  assert.match(settings, /Save Changes/)
  assert.match(section, /Save section/)
})

test("every profile area is independently saveable", () => {
  for (const sectionId of [
    "details",
    "location",
    "photos",
    "facilities",
    "languages",
    "arrival-departure",
    "policies",
    "contact",
  ]) {
    assert.match(profile, new RegExp(`saveSection\\(\"${sectionId}\"`))
  }
  assert.match(profile, /`\/business\/property-profile\/\$\{section\}`/)
  assert.match(section, /Save section/)
  assert.match(section, /Section saved|Saved/)
})

test("canonical Business fields remain visible in the profile contract", () => {
  assert.match(types, /propertyName: string/)
  assert.match(types, /address: string/)
  assert.match(types, /country: string/)
  assert.match(types, /timezone: string/)
  assert.match(types, /phone: string/)
  assert.match(types, /email: string/)
  assert.match(profile, /updates the existing guest-facing business name/i)
  assert.match(types, /verified: boolean/)
  assert.match(profile, /Google-verified address and map details used for Discovery/i)
  assert.match(profile, /existing hotel check-in and check-out defaults remain the canonical/i)
})

test("facilities, languages, policies, and parking use structured controls", () => {
  assert.match(profile, /catalogs\.facilityGroups/)
  assert.match(profile, /role="checkbox"/)
  assert.match(profile, /catalogs\.languages/)
  assert.match(profile, /parking\.available === true/)
  assert.match(profile, /cost: null, reservation: null, location: null, access: null/)
  assert.match(profile, /childrenAllowed/)
  assert.match(profile, /petsPolicy/)
  assert.doesNotMatch(profile, /Room Type amenities[\s\S]*facilityIds.*room/i)
})

test("property media supports multiple upload, cover, reorder, and removal", () => {
  assert.match(profile, /multiple/)
  assert.match(profile, /\/upload\/property-photo/)
  assert.match(profile, /makeCover/)
  assert.match(profile, /movePhotoBefore/)
  assert.match(profile, /draggable/)
  assert.match(profile, /photoIds: photos\.map/)
  assert.match(profile, /Remove property photo/)
})

test("completeness distinguishes required and recommended without gating PMS use", () => {
  assert.match(types, /category: "required" \| "recommended"/)
  assert.match(profile, /completeness\?\.percentage/)
  assert.match(profile, /item\.category === "required"/)
  assert.match(profile, /incomplete profile never blocks/i)
})

test("responsive structure preserves scrollable tabs and profile disclosure", () => {
  assert.match(settings, /overflow-x-auto/)
  assert.match(settings, /min-w-max/)
  assert.match(profile, /xl:grid-cols-\[minmax\(0,1fr\)_300px\]/)
  assert.match(profile, /sm:grid-cols-2/)
  assert.match(profile, /GoogleAddressSelector/)
  assert.match(profile, /facilities\.parking\.available === true/)
  assert.match(profile, /max-h-72.*overflow-y-auto/)
})

test("Business Profile location uses Google-selected canonical data rather than manual address fields", () => {
  assert.match(profile, /saveDisabled=\{!pendingLocationSelection\}/)
  assert.match(profile, /addressPlaceId: pendingLocationSelection\.placeId/)
  assert.match(profile, /addressSessionToken: pendingLocationSelection\.sessionToken/)
  assert.match(profile, /countryCode: pendingLocationSelection\.countryCode/)
  assert.match(profile, /GoogleAddressSelector/)
  assert.doesNotMatch(profile, /id="property-city"/)
  assert.doesNotMatch(profile, /id="property-latitude"/)
  assert.doesNotMatch(profile, /id="property-longitude"/)
  assert.match(addressSelector, /"\/business\/property-profile\/address-suggestions"/)
  assert.match(addressSelector, /crypto\.randomUUID\(\)/)
  assert.match(addressSelector, /AbortController/)
  assert.match(addressSelector, /Google Maps/)
})