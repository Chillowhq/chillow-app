"use client"

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock3,
  Coffee,
  GripVertical,
  Heart,
  Images,
  Info,
  Languages,
  Leaf,
  Loader2,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Store,
  Upload,
  UtensilsCrossed,
  Wine,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { toast } from "sonner"

import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChoiceGroup,
  FieldLabel,
  PropertyProfileSection,
} from "@/components/property-profile/PropertyProfileSection"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { apiClient } from "@/lib/axios-config"
import { GoogleAddressSelector, type GoogleAddressSelection } from "@/components/property-profile/GoogleAddressSelector"
import { MANAGEMENT_ACCESS_AREAS } from "@/lib/manager-permissions"
import {
  getPropertyProfileContactDefaultValues,
  propertyProfileContactSchema,
  toPropertyProfileContactPayload,
  type PropertyProfileContactFormValues,
} from "./PropertyProfileSettings.validation"
import type {
  PropertyPhoto,
  DiscoveryPublication,
  PropertyProfileCatalog,
  PropertyProfileCompleteness,
  PropertyProfileResponse,
} from "@/types/property-profile"

const MANAGEMENT_ROLES = ["owner", "co_owner"]
const INPUT_CLASS = "h-11 rounded-xl border-border bg-background px-3 font-medium"
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 === 0 ? "00" : "30"
  const value = `${String(hour).padStart(2, "0")}:${minute}`
  const hour12 = hour % 12 || 12
  const period = hour < 12 ? "AM" : "PM"
  return { value, label: `${hour12}:${minute} ${period}` }
})

function formatTimeLabel(value: string) {
  const [rawHour, rawMinute] = value.split(":")
  const hour = Number(rawHour)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !/^\d{2}$/.test(rawMinute || "")) return value
  return `${hour % 12 || 12}:${rawMinute} ${hour < 12 ? "AM" : "PM"}`
}

type SectionId =
  | "details"
  | "location"
  | "photos"
  | "facilities"
  | "languages"
  | "arrival-departure"
  | "policies"
  | "contact"
  | "cuisine"
  | "atmosphere"
  | "dietary-accessibility"

type DetailsState = PropertyProfileResponse["details"]
type LocationState = Omit<PropertyProfileResponse["location"], "latitude" | "longitude"> & {
  latitude: string
  longitude: string
}
type PendingLocationSelection = GoogleAddressSelection
type FacilitiesState = PropertyProfileResponse["facilities"]
type ArrivalState = NonNullable<PropertyProfileResponse["arrivalDeparture"]>
type PoliciesState = PropertyProfileResponse["policies"]
type CuisineState = NonNullable<PropertyProfileResponse["cuisine"]>
type AtmosphereState = NonNullable<PropertyProfileResponse["atmosphere"]>
type DietaryState = NonNullable<PropertyProfileResponse["dietaryAccessibility"]>

function errorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
    || (error as { response?: { data?: { error?: string } } })?.response?.data?.error
    || fallback
}

function emptyDetails(): DetailsState {
  return { propertyName: "", description: "", accommodationType: null, starRating: null, tagline: "", priceLevel: null, diningStyle: null }
}

function emptyLocation(): LocationState {
  return {
    address: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
    countryCode: "",
    verified: false,
    latitude: "",
    longitude: "",
  }
}

function emptyFacilities(): FacilitiesState {
  return {
    facilityIds: [],
    parking: { available: null, cost: null, reservation: null, location: null, access: null },
    breakfastOffered: null,
  }
}

function emptyArrival(): ArrivalState {
  return {
    checkInFrom: "15:00",
    checkInUntil: "22:00",
    checkOutFrom: "07:00",
    checkOutUntil: "11:00",
    timezone: "UTC",
  }
}

function emptyPolicies(): PoliciesState {
  return { childrenAllowed: null, petsPolicy: null, reservationPolicy: null }
}

function emptyCuisine(): CuisineState {
  return { cuisineTypes: [], mealServices: [] }
}

function emptyAtmosphere(): AtmosphereState {
  return { atmosphere: [], dressCode: null }
}

function emptyDietary(): DietaryState {
  return { dietaryOptions: [], accessibility: [] }
}

function TimeSelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const options = TIME_OPTIONS.some(option => option.value === value)
    ? TIME_OPTIONS
    : [...TIME_OPTIONS, { value, label: formatTimeLabel(value) }]
        .sort((left, right) => left.value.localeCompare(right.value))

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 rounded-xl bg-background" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function PropertyProfileSettings() {
  const { user, loading: authLoading } = useAuthGuard({
    allowedRoles: MANAGEMENT_ROLES,
    requiredArea: MANAGEMENT_ACCESS_AREAS.BUSINESS_SETTINGS,
  })
  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState<DetailsState>(emptyDetails)
  const [location, setLocation] = useState<LocationState>(emptyLocation)
  const [pendingLocationSelection, setPendingLocationSelection] = useState<PendingLocationSelection | null>(null)
  const [photos, setPhotos] = useState<PropertyPhoto[]>([])
  const [facilities, setFacilities] = useState<FacilitiesState>(emptyFacilities)
  const [languages, setLanguages] = useState<string[]>([])
  const [arrival, setArrival] = useState<ArrivalState>(emptyArrival)
  const [policies, setPolicies] = useState<PoliciesState>(emptyPolicies)
  const [catalogs, setCatalogs] = useState<PropertyProfileCatalog>({
    accommodationTypes: [],
    facilityGroups: [],
    languages: [],
  })
  const [completeness, setCompleteness] = useState<PropertyProfileCompleteness | null>(null)
  const [discoveryPublication, setDiscoveryPublication] = useState<DiscoveryPublication | null>(null)
  const [savingDiscoveryPublication, setSavingDiscoveryPublication] = useState(false)
  const [savingSection, setSavingSection] = useState<SectionId | null>(null)
  const [savedSection, setSavedSection] = useState<SectionId | null>(null)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [facilitySearch, setFacilitySearch] = useState("")
  const [languageSearch, setLanguageSearch] = useState("")
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null)
  const [contactError, setContactError] = useState<string | null>(null)
  // F&B-specific state
  const [cuisine, setCuisine] = useState<CuisineState>(emptyCuisine)
  const [atmosphereState, setAtmosphereState] = useState<AtmosphereState>(emptyAtmosphere)
  const [dietaryState, setDietaryState] = useState<DietaryState>(emptyDietary)
  const [cuisineSearch, setCuisineSearch] = useState("")
  const [atmosphereSearch, setAtmosphereSearch] = useState("")
  const photoInputRef = useRef<HTMLInputElement>(null)
  const contactSubmissionInFlight = useRef(false)
  const isHotel = user?.capabilities?.identity.shell === "hotel" || user?.businessType === "hotel"
  const isFnb = !isHotel
  const contactForm = useForm<PropertyProfileContactFormValues>({
    resolver: zodResolver(propertyProfileContactSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getPropertyProfileContactDefaultValues(),
  })
  const isContactSaving = savingSection === "contact" || contactForm.formState.isSubmitting
  const applyProfile = (profile: PropertyProfileResponse) => {
    setDetails(profile.details)
    setLocation({
      ...profile.location,
      latitude: profile.location.latitude === null ? "" : String(profile.location.latitude),
      longitude: profile.location.longitude === null ? "" : String(profile.location.longitude),
    })
    setPendingLocationSelection(null)
    setPhotos(profile.photos)
    setFacilities(profile.facilities)
    setLanguages(profile.languages)
    if (profile.arrivalDeparture) setArrival(profile.arrivalDeparture)
    setPolicies(profile.policies)
    if (profile.cuisine) setCuisine(profile.cuisine)
    if (profile.atmosphere) setAtmosphereState(profile.atmosphere)
    if (profile.dietaryAccessibility) setDietaryState(profile.dietaryAccessibility)
    contactForm.reset(getPropertyProfileContactDefaultValues(profile.contact))
    setCatalogs(profile.catalogs)
    setCompleteness(profile.completeness)
    setDiscoveryPublication(profile.discoveryPublication)
  }

  useEffect(() => {
    if (!user) {
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get<PropertyProfileResponse>("/business/property-profile")
        if (!cancelled) applyProfile(response.data)
      } catch (error) {
        if (!cancelled) toast.error(errorMessage(error, "Could not load profile"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user?.businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!savedSection) return
    const timeout = window.setTimeout(() => setSavedSection(null), 2200)
    return () => window.clearTimeout(timeout)
  }, [savedSection])

  const applySavedSection = (section: SectionId, response: PropertyProfileResponse) => {
    if (section === "details") setDetails(response.details)
    if (section === "location") {
      setLocation({
        ...response.location,
        latitude: response.location.latitude === null ? "" : String(response.location.latitude),
        longitude: response.location.longitude === null ? "" : String(response.location.longitude),
      })
    }
    if (section === "location") setPendingLocationSelection(null)
    if (section === "photos") setPhotos(response.photos)
    if (section === "facilities") setFacilities(response.facilities)
    if (section === "languages") setLanguages(response.languages)
    if (section === "arrival-departure" && response.arrivalDeparture) setArrival(response.arrivalDeparture)
    if (section === "policies") setPolicies(response.policies)
    if (section === "contact") contactForm.reset(getPropertyProfileContactDefaultValues(response.contact))
    if (section === "cuisine" && response.cuisine) setCuisine(response.cuisine)
    if (section === "atmosphere" && response.atmosphere) setAtmosphereState(response.atmosphere)
    if (section === "dietary-accessibility" && response.dietaryAccessibility) setDietaryState(response.dietaryAccessibility)
    setCompleteness(response.completeness)
  }

  const saveSection = async (section: SectionId, payload: unknown) => {
    try {
      setSavingSection(section)
      const response = await apiClient.patch<PropertyProfileResponse>(
        `/business/property-profile/${section}`,
        payload,
      )
      applySavedSection(section, response.data)
      setSavedSection(section)
      toast.success("Section saved")
      return { success: true as const }
    } catch (error) {
      const message = errorMessage(error, "Could not save this section")
      toast.error(message)
      return { success: false as const, message }
    } finally {
      setSavingSection(null)
    }
  }

  const saveDiscoveryPublication = async () => {
    if (!discoveryPublication || savingDiscoveryPublication) return

    const nextPublication = !discoveryPublication.discoveryPublished
    if (nextPublication && !discoveryPublication.eligibility.eligible) return

    try {
      setSavingDiscoveryPublication(true)
      const response = await apiClient.patch<PropertyProfileResponse>(
        "/business/property-profile/discovery-publication",
        { discoveryPublished: nextPublication },
      )
      applyProfile(response.data)
      toast.success(nextPublication ? "Published to Chillow Discovery" : "Removed from Chillow Discovery")
    } catch (error) {
      toast.error(errorMessage(error, "Could not update Chillow Discovery publication"))
    } finally {
      setSavingDiscoveryPublication(false)
    }
  }

  const handleContactSubmit = async (values: PropertyProfileContactFormValues) => {
    if (contactSubmissionInFlight.current || savingSection === "contact") return

    contactSubmissionInFlight.current = true
    setContactError(null)

    try {
      const result = await saveSection("contact", toPropertyProfileContactPayload(values))
      if (!result.success) setContactError(result.message)
    } finally {
      contactSubmissionInFlight.current = false
    }
  }
  const toggleFacility = (facilityId: string) => {
    setFacilities(current => ({
      ...current,
      facilityIds: current.facilityIds.includes(facilityId)
        ? current.facilityIds.filter(id => id !== facilityId)
        : [...current.facilityIds, facilityId],
    }))
  }

  const toggleLanguage = (languageId: string) => {
    setLanguages(current => current.includes(languageId)
      ? current.filter(id => id !== languageId)
      : [...current, languageId])
  }

  const movePhoto = (photoId: string, direction: -1 | 1) => {
    setPhotos(current => {
      const index = current.findIndex(photo => photo.id === photoId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const movePhotoBefore = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setPhotos(current => {
      const sourceIndex = current.findIndex(photo => photo.id === sourceId)
      const targetIndex = current.findIndex(photo => photo.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [source] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, source)
      return next
    })
  }

  const makeCover = (photoId: string) => {
    setPhotos(current => {
      const selected = current.find(photo => photo.id === photoId)
      return selected ? [selected, ...current.filter(photo => photo.id !== photoId)] : current
    })
  }

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const selectedFiles = Array.from(files)
    const invalid = selectedFiles.find(file => (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024
    ))
    if (invalid) {
      toast.error("Photos must be JPG, PNG or WebP and no larger than 5MB")
      if (photoInputRef.current) photoInputRef.current.value = ""
      return
    }

    try {
      setUploadingPhotos(true)
      for (const file of selectedFiles) {
        const form = new FormData()
        form.append("image", file)
        const response = await apiClient.post<{
          photo: PropertyPhoto
          completeness: PropertyProfileCompleteness
        }>("/upload/property-photo", form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        setPhotos(current => [...current, response.data.photo])
        setCompleteness(response.data.completeness)
      }
      setSavedSection("photos")
      toast.success(selectedFiles.length === 1 ? "Property photo uploaded" : `${selectedFiles.length} property photos uploaded`)
    } catch (error) {
      toast.error(errorMessage(error, "Property photo upload failed"))
    } finally {
      setUploadingPhotos(false)
      if (photoInputRef.current) photoInputRef.current.value = ""
    }
  }

  const filteredFacilityGroups = useMemo(() => {
    const query = facilitySearch.trim().toLowerCase()
    const groups = isFnb ? (catalogs.restaurantFacilityGroups || []) : catalogs.facilityGroups
    if (!query) return groups
    return groups
      .map(group => ({
        ...group,
        facilities: group.facilities.filter(facility => facility.label.toLowerCase().includes(query)),
      }))
      .filter(group => group.facilities.length > 0)
  }, [catalogs.facilityGroups, catalogs.restaurantFacilityGroups, facilitySearch, isFnb])

  const filteredCuisineTypes = useMemo(() => {
    const query = cuisineSearch.trim().toLowerCase()
    return (catalogs.cuisineTypes || []).filter(c => c.label.toLowerCase().includes(query))
  }, [catalogs.cuisineTypes, cuisineSearch])

  const filteredAtmosphereTags = useMemo(() => {
    const query = atmosphereSearch.trim().toLowerCase()
    return (catalogs.atmosphereTags || []).filter(a => a.label.toLowerCase().includes(query))
  }, [catalogs.atmosphereTags, atmosphereSearch])

  const filteredLanguages = useMemo(() => {
    const query = languageSearch.trim().toLowerCase()
    return catalogs.languages.filter(language => language.label.toLowerCase().includes(query))
  }, [catalogs.languages, languageSearch])

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        {isHotel ? "Loading Property Profile…" : "Loading Business Profile…"}
      </div>
    )
  }

  const profileTitle = isHotel ? "Property Profile" : "Business Profile"
  const profileDescription = isHotel
    ? "Manage the information guests see about your property."
    : "Manage the guest-facing information customers see in Chillow Discovery."
  const discoveryPublished = discoveryPublication?.discoveryPublished ?? false
  const discoveryEligible = discoveryPublication?.eligibility.eligible ?? false
  const discoveryBlockers = discoveryPublication?.eligibility.blockers ?? []
  const discoveryEffectivePublic = discoveryPublication?.effectivePublic ?? false
  const discoveryActionDisabled = savingDiscoveryPublication || (!discoveryPublished && !discoveryEligible)

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {isHotel ? <Building2 className="h-6 w-6 text-primary" /> : <Store className="h-6 w-6 text-primary" />}
              <h1 className="text-2xl font-black tracking-tight text-foreground">{profileTitle}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{profileDescription}</p>
          </div>
          <div className="min-w-[260px] rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{profileTitle}</span>
              <span className="font-black text-primary">{completeness?.percentage ?? 0}% complete</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${completeness?.percentage ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="discovery-publication-heading">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 id="discovery-publication-heading" className="text-lg font-black tracking-tight text-foreground">Appear on Chillow Discovery</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">This controls your Discovery listing only. It does not change your storefront, reservations, or daily operations.</p>
            <p className="mt-3 text-sm font-semibold text-foreground" aria-live="polite">
              {discoveryPublished
                ? (discoveryEffectivePublic ? "Published and visible to Discovery guests." : "Published, but currently hidden because the profile no longer meets Discovery requirements.")
                : "Not published to Chillow Discovery."}
            </p>
            {!discoveryEligible && (
              <div className="mt-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-bold">Complete these items before publishing:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {discoveryBlockers.map(blocker => <li key={blocker.code}>{blocker.message}</li>)}
                </ul>
              </div>
            )}
          </div>
          <Button
            type="button"
            className="w-full shrink-0 sm:w-auto"
            disabled={discoveryActionDisabled}
            aria-busy={savingDiscoveryPublication}
            onClick={() => void saveDiscoveryPublication()}
          >
            {savingDiscoveryPublication && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {discoveryPublished ? "Remove from Chillow Discovery" : "Publish on Chillow Discovery"}
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <PropertyProfileSection
            id="property-details"
            title={isHotel ? "Property Details" : "Business Details"}
            description={isHotel ? "The core identity guests will see." : "Name, description, and dining concept."}
            icon={isHotel ? <Building2 className="h-5 w-5" /> : <Store className="h-5 w-5" />}
            saving={savingSection === "details"}
            saved={savedSection === "details"}
            onSave={() => void saveSection("details", details)}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="property-name">{isHotel ? "Property name" : "Business name"}</FieldLabel>
                <Input
                  id="property-name"
                  value={details.propertyName}
                  onChange={event => setDetails(current => ({ ...current, propertyName: event.target.value }))}
                  className={INPUT_CLASS}
                  maxLength={160}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">This updates the existing guest-facing business name.</p>
              </div>
              {isHotel && (
                <div>
                  <FieldLabel htmlFor="accommodation-type">Accommodation type</FieldLabel>
                  <Select
                    value={details.accommodationType || "unset"}
                    onValueChange={value => setDetails(current => ({ ...current, accommodationType: value === "unset" ? null : value }))}
                  >
                    <SelectTrigger id="accommodation-type" className="h-11 rounded-xl bg-background"><SelectValue placeholder="Choose a type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not set</SelectItem>
                      {catalogs.accommodationTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isFnb && (
                <div>
                  <FieldLabel htmlFor="dining-style">Dining style</FieldLabel>
                  <Select
                    value={details.diningStyle || "unset"}
                    onValueChange={value => setDetails(current => ({ ...current, diningStyle: value === "unset" ? null : value }))}
                  >
                    <SelectTrigger id="dining-style" className="h-11 rounded-xl bg-background"><SelectValue placeholder="Choose a style" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not set</SelectItem>
                      {(catalogs.diningStyles || []).map(style => <SelectItem key={style.id} value={style.id}>{style.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {isFnb && (
              <div>
                <FieldLabel htmlFor="property-tagline">Catchy tagline <span className="font-medium text-muted-foreground">(max 120 chars)</span></FieldLabel>
                <Input
                  id="property-tagline"
                  value={details.tagline || ""}
                  onChange={event => setDetails(current => ({ ...current, tagline: event.target.value }))}
                  className={INPUT_CLASS}
                  maxLength={120}
                  placeholder="e.g. Artisanal pasta & natural wines on the harbour"
                />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="property-description">Guest-facing description</FieldLabel>
                <span className="text-xs text-muted-foreground">{details.description.length}/3000</span>
              </div>
              <Textarea
                id="property-description"
                value={details.description}
                onChange={event => setDetails(current => ({ ...current, description: event.target.value }))}
                className="min-h-32 rounded-2xl bg-background"
                maxLength={3000}
                placeholder={isHotel ? "Tell guests what makes your property special." : "Tell customers what makes your venue special."}
              />
            </div>
            {isHotel && (
              <div className="max-w-sm">
                <FieldLabel htmlFor="property-star-rating">Official star rating <span className="font-medium text-muted-foreground">(optional)</span></FieldLabel>
                <Select
                  value={details.starRating === null ? "unrated" : String(details.starRating)}
                  onValueChange={value => setDetails(current => ({ ...current, starRating: value === "unrated" ? null : Number(value) }))}
                >
                  <SelectTrigger id="property-star-rating" className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unrated">Not applicable / Unrated</SelectItem>
                    {[1, 2, 3, 4, 5].map(rating => <SelectItem key={rating} value={String(rating)}>{rating} star{rating > 1 ? "s" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isFnb && (
              <div className="max-w-sm">
                <FieldLabel>Price level</FieldLabel>
                <ChoiceGroup
                  ariaLabel="Price level"
                  value={details.priceLevel ?? null}
                  onChange={value => setDetails(current => ({ ...current, priceLevel: value as number | null }))}
                  options={[
                    { value: 1, label: "$ Budget" },
                    { value: 2, label: "$$ Moderate" },
                    { value: 3, label: "$$$ Upscale" },
                    { value: 4, label: "$$$$ Fine dining" },
                    { value: null, label: "Not set" },
                  ]}
                />
              </div>
            )}
          </PropertyProfileSection>

          <PropertyProfileSection
            id="location"
            title="Location"
            description="Google-verified address and map details used for Discovery and directions."
            icon={<MapPin className="h-5 w-5" />}
            saving={savingSection === "location"}
            saved={savedSection === "location"}
            saveDisabled={!pendingLocationSelection}
            onSave={() => {
              if (!pendingLocationSelection) return
              void saveSection("location", {
                addressPlaceId: pendingLocationSelection.placeId,
                addressSessionToken: pendingLocationSelection.sessionToken,
                countryCode: pendingLocationSelection.countryCode,
              })
            }}
          >
            {location.verified ? (
              <p className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                This is a Google-verified address. Search and select another result to update it.
              </p>
            ) : (
              <FormNotice tone="warning">This location has not been verified by Google Maps. Select the current address from the suggestions before it can be used reliably in Discovery.</FormNotice>
            )}

            <GoogleAddressSelector
              address={pendingLocationSelection?.address ?? location.address}
              countryCode={pendingLocationSelection?.countryCode ?? location.countryCode}
              disabled={savingSection === "location"}
              onSelect={setPendingLocationSelection}
              onClearSelection={() => setPendingLocationSelection(null)}
            />

            {pendingLocationSelection ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <p className="font-bold text-foreground">Ready to save the selected Google address</p>
                <p className="mt-1 text-muted-foreground">{pendingLocationSelection.address}</p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-secondary/15 p-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">City</dt>
                  <dd className="mt-1 font-medium">{location.city || "Provided by Google when available"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Region / state</dt>
                  <dd className="mt-1 font-medium">{location.region || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Postal code</dt>
                  <dd className="mt-1 font-medium">{location.postalCode || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Map coordinates</dt>
                  <dd className="mt-1 font-medium tabular-nums">{location.latitude && location.longitude ? `${location.latitude}, ${location.longitude}` : "Provided by Google when available"}</dd>
                </div>
              </dl>
            </div>
          </PropertyProfileSection>

          <PropertyProfileSection
            id="photos"
            title="Property Photos"
            description="Exterior, reception, common areas and facilities. Room photos stay with Room Types."
            icon={<Images className="h-5 w-5" />}
            saving={savingSection === "photos"}
            saved={savedSection === "photos"}
            onSave={() => void saveSection("photos", { photoIds: photos.map(photo => photo.id) })}
          >
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={event => void uploadPhotos(event.target.files)}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhotos || photos.length >= 30}
              className="flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/25 bg-primary/5 p-6 text-center transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadingPhotos ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Upload className="h-7 w-7 text-primary" />}
              <span className="mt-2 font-black">{uploadingPhotos ? "Uploading…" : "Upload property photos"}</span>
              <span className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP · maximum 5MB each · up to 30 photos</span>
            </button>
            {photos.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {photos.map((photo, index) => (
                  <article
                    key={photo.id}
                    draggable
                    onDragStart={() => setDraggedPhotoId(photo.id)}
                    onDragEnd={() => setDraggedPhotoId(null)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={() => {
                      if (draggedPhotoId) movePhotoBefore(draggedPhotoId, photo.id)
                      setDraggedPhotoId(null)
                    }}
                    className={`group overflow-hidden rounded-2xl border bg-background ${draggedPhotoId === photo.id ? "border-primary opacity-60" : "border-border"}`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                      {/* Property photos use owner-uploaded HTTPS URLs; image optimization is intentionally deferred until the CDN allowlist is centralized. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Property photo ${index + 1}`} className="h-full w-full object-cover" />
                      {index === 0 ? <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[11px] font-black text-primary-foreground">Cover</span> : null}
                      <button type="button" aria-label={`Remove property photo ${index + 1}`} onClick={() => setPhotos(current => current.filter(item => item.id !== photo.id))} className="absolute right-2 top-2 rounded-full bg-black/65 p-1.5 text-white hover:bg-black/80"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="flex items-center gap-1 p-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {index !== 0 ? <button type="button" onClick={() => makeCover(photo.id)} className="mr-auto text-xs font-bold text-primary hover:underline">Make cover</button> : <span className="mr-auto text-xs font-medium text-muted-foreground">Hero image</span>}
                      <button type="button" disabled={index === 0} onClick={() => movePhoto(photo.id, -1)} aria-label="Move photo earlier" className="rounded-lg border border-border p-1.5 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={index === photos.length - 1} onClick={() => movePhoto(photo.id, 1)} aria-label="Move photo later" className="rounded-lg border border-border p-1.5 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">No photos yet. This does not prevent normal operation.</p>
            )}
          </PropertyProfileSection>

          {/* ==================== F&B: Cuisine & Concept ==================== */}
          {isFnb && (
            <PropertyProfileSection
              id="cuisines"
              title="Cuisine & Concept"
              description="Help guests discover your food and meal offerings."
              icon={<UtensilsCrossed className="h-5 w-5" />}
              saving={savingSection === "cuisine"}
              saved={savedSection === "cuisine"}
              onSave={() => void saveSection("cuisine", cuisine)}
            >
              <div>
                <FieldLabel>Cuisine types</FieldLabel>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input value={cuisineSearch} onChange={event => setCuisineSearch(event.target.value)} className={`${INPUT_CLASS} pl-10`} placeholder="Search cuisines…" />
                </div>
                {cuisine.cuisineTypes.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {cuisine.cuisineTypes.map(id => {
                      const item = (catalogs.cuisineTypes || []).find(c => c.id === id)
                      return <button key={id} type="button" onClick={() => setCuisine(c => ({ ...c, cuisineTypes: c.cuisineTypes.filter(t => t !== id) }))} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">{item?.label || id}<X className="h-3.5 w-3.5" /></button>
                    })}
                  </div>
                )}
                <div className="grid max-h-60 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCuisineTypes.map(ct => {
                    const selected = cuisine.cuisineTypes.includes(ct.id)
                    return <button key={ct.id} type="button" role="checkbox" aria-checked={selected} onClick={() => setCuisine(c => ({ ...c, cuisineTypes: selected ? c.cuisineTypes.filter(t => t !== ct.id) : [...c.cuisineTypes, ct.id] }))} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${selected ? "border-primary bg-primary/5" : "border-border bg-background text-muted-foreground"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>{ct.label}</button>
                  })}
                </div>
              </div>
              <div className="border-t border-border pt-5">
                <FieldLabel>Meal services offered</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {(catalogs.mealServices || []).map(ms => {
                    const selected = cuisine.mealServices.includes(ms.id)
                    return <button key={ms.id} type="button" role="checkbox" aria-checked={selected} onClick={() => setCuisine(c => ({ ...c, mealServices: selected ? c.mealServices.filter(m => m !== ms.id) : [...c.mealServices, ms.id] }))} className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/30"}`}>{ms.label}</button>
                  })}
                </div>
              </div>
            </PropertyProfileSection>
          )}

          {/* ==================== F&B: Atmosphere & Experience ==================== */}
          {isFnb && (
            <PropertyProfileSection
              id="atmosphere"
              title="Atmosphere & Experience"
              description="Help guests know what to expect when they visit."
              icon={<Heart className="h-5 w-5" />}
              saving={savingSection === "atmosphere"}
              saved={savedSection === "atmosphere"}
              onSave={() => void saveSection("atmosphere", atmosphereState)}
            >
              <div>
                <FieldLabel>Vibe & setting</FieldLabel>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input value={atmosphereSearch} onChange={event => setAtmosphereSearch(event.target.value)} className={`${INPUT_CLASS} pl-10`} placeholder="Search vibes…" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {filteredAtmosphereTags.map(tag => {
                    const selected = atmosphereState.atmosphere.includes(tag.id)
                    return <button key={tag.id} type="button" role="checkbox" aria-checked={selected} onClick={() => setAtmosphereState(a => ({ ...a, atmosphere: selected ? a.atmosphere.filter(t => t !== tag.id) : [...a.atmosphere, tag.id] }))} className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/30"}`}>{tag.label}</button>
                  })}
                </div>
              </div>
              <div className="border-t border-border pt-5">
                <FieldLabel>Dress code</FieldLabel>
                <ChoiceGroup
                  ariaLabel="Dress code"
                  value={atmosphereState.dressCode}
                  onChange={value => setAtmosphereState(a => ({ ...a, dressCode: value }))}
                  options={[
                    ...(catalogs.dressCodes || []).map(dc => ({ value: dc.id, label: dc.label })),
                    { value: null, label: "Not specified" },
                  ]}
                />
              </div>
            </PropertyProfileSection>
          )}

          <PropertyProfileSection
            id="facilities"
            title={isHotel ? "Facilities & Services" : "Facilities & Highlights"}
            description={isHotel ? "Property-wide services only — not Room Type amenities." : "Venue features and beverage highlights."}
            icon={<Sparkles className="h-5 w-5" />}
            saving={savingSection === "facilities"}
            saved={savedSection === "facilities"}
            onSave={() => void saveSection("facilities", facilities)}
          >
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input value={facilitySearch} onChange={event => setFacilitySearch(event.target.value)} className={`${INPUT_CLASS} pl-10`} placeholder="Search facilities and services…" />
            </div>
            <div className="space-y-5">
              {filteredFacilityGroups.map(group => (
                <div key={group.id}>
                  <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">{group.label}</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.facilities.map(facility => {
                      const selected = facilities.facilityIds.includes(facility.id)
                      return (
                        <button key={facility.id} type="button" role="checkbox" aria-checked={selected} onClick={() => toggleFacility(facility.id)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-colors ${selected ? "border-primary bg-primary/5 text-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/30"}`}>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>
                          {facility.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {isHotel && (
              <div className="border-t border-border pt-5">
                <div className="mb-3 flex items-center gap-2"><Coffee className="h-5 w-5 text-primary" /><h3 className="font-black">Breakfast</h3></div>
                <FieldLabel>Do you serve breakfast?</FieldLabel>
                <ChoiceGroup
                  ariaLabel="Breakfast offered"
                  value={facilities.breakfastOffered ?? null}
                  onChange={value => setFacilities(current => ({ ...current, breakfastOffered: value }))}
                  options={[{ value: true, label: "Yes" }, { value: false, label: "No" }, { value: null, label: "Not answered" }]}
                />
              </div>
            )}

            {isFnb && (
              <div className="border-t border-border pt-5">
                <div className="mb-3 flex items-center gap-2"><Wine className="h-5 w-5 text-primary" /><h3 className="font-black">Bar & Beverage Highlights</h3></div>
                <div className="flex flex-wrap gap-2">
                  {(catalogs.barHighlights || []).map(bh => {
                    const selected = (facilities.barHighlights || []).includes(bh.id)
                    return <button key={bh.id} type="button" role="checkbox" aria-checked={selected} onClick={() => setFacilities(current => ({
                      ...current,
                      barHighlights: selected
                        ? (current.barHighlights || []).filter(id => id !== bh.id)
                        : [...(current.barHighlights || []), bh.id],
                    }))} className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/30"}`}>{bh.label}</button>
                  })}
                </div>
              </div>
            )}

            <div className="border-t border-border pt-5">
              <div className="mb-3 flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /><h3 className="font-black">Parking</h3></div>
              <FieldLabel>Is parking available?</FieldLabel>
              <ChoiceGroup
                ariaLabel="Parking availability"
                value={facilities.parking.available}
                onChange={value => setFacilities(current => ({
                  ...current,
                  parking: value === true
                    ? { ...current.parking, available: true }
                    : { available: value, cost: null, reservation: null, location: null, access: null },
                }))}
                options={[{ value: true, label: "Yes" }, { value: false, label: "No" }, { value: null, label: "Not answered" }]}
              />
              {facilities.parking.available === true ? (
                <div className="mt-5 grid gap-5 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Cost</FieldLabel>
                    <ChoiceGroup ariaLabel="Parking cost" value={facilities.parking.cost} onChange={value => setFacilities(current => ({ ...current, parking: { ...current.parking, cost: value } }))} options={[{ value: "free", label: "Free" }, { value: "paid", label: "Paid" }, { value: null, label: "Not set" }]} />
                  </div>
                  <div>
                    <FieldLabel>Reservation</FieldLabel>
                    <ChoiceGroup ariaLabel="Parking reservation" value={facilities.parking.reservation} onChange={value => setFacilities(current => ({ ...current, parking: { ...current.parking, reservation: value } }))} options={[{ value: "required", label: "Required" }, { value: "not_required", label: "Not needed" }, { value: null, label: "Not set" }]} />
                  </div>
                  <div>
                    <FieldLabel>Location</FieldLabel>
                    <ChoiceGroup ariaLabel="Parking location" value={facilities.parking.location} onChange={value => setFacilities(current => ({ ...current, parking: { ...current.parking, location: value } }))} options={[{ value: "onsite", label: "On-site" }, { value: "offsite", label: "Off-site" }, { value: null, label: "Not set" }]} />
                  </div>
                  <div>
                    <FieldLabel>Access</FieldLabel>
                    <ChoiceGroup ariaLabel="Parking access" value={facilities.parking.access} onChange={value => setFacilities(current => ({ ...current, parking: { ...current.parking, access: value } }))} options={[{ value: "private", label: "Private" }, { value: "public", label: "Public" }, { value: null, label: "Not set" }]} />
                  </div>
                </div>
              ) : null}
            </div>
          </PropertyProfileSection>

          <PropertyProfileSection
            id="languages"
            title="Languages"
            description="Languages guests can reasonably use with staff."
            icon={<Languages className="h-5 w-5" />}
            saving={savingSection === "languages"}
            saved={savedSection === "languages"}
            onSave={() => void saveSection("languages", { languages })}
          >
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input value={languageSearch} onChange={event => setLanguageSearch(event.target.value)} className={`${INPUT_CLASS} pl-10`} placeholder="Search languages…" />
            </div>
            {languages.length ? (
              <div className="flex flex-wrap gap-2">
                {languages.map(id => {
                  const language = catalogs.languages.find(option => option.id === id)
                  return <button key={id} type="button" onClick={() => toggleLanguage(id)} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">{language?.label || id}<X className="h-3.5 w-3.5" /></button>
                })}
              </div>
            ) : null}
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLanguages.map(language => {
                const selected = languages.includes(language.id)
                return <button key={language.id} type="button" role="checkbox" aria-checked={selected} onClick={() => toggleLanguage(language.id)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${selected ? "border-primary bg-primary/5" : "border-border bg-background text-muted-foreground"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>{language.label}</button>
              })}
            </div>
          </PropertyProfileSection>

          {/* ==================== F&B: Dietary & Accessibility ==================== */}
          {isFnb && (
            <PropertyProfileSection
              id="dietary"
              title="Dietary & Accessibility"
              description="Dietary accommodations and venue accessibility features."
              icon={<Leaf className="h-5 w-5" />}
              saving={savingSection === "dietary-accessibility"}
              saved={savedSection === "dietary-accessibility"}
              onSave={() => void saveSection("dietary-accessibility", dietaryState)}
            >
              <div>
                <FieldLabel>Dietary options</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(catalogs.dietaryOptions || []).map(opt => {
                    const selected = dietaryState.dietaryOptions.includes(opt.id)
                    return <button key={opt.id} type="button" role="checkbox" aria-checked={selected} onClick={() => setDietaryState(d => ({ ...d, dietaryOptions: selected ? d.dietaryOptions.filter(id => id !== opt.id) : [...d.dietaryOptions, opt.id] }))} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${selected ? "border-primary bg-primary/5" : "border-border bg-background text-muted-foreground"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>{opt.label}</button>
                  })}
                </div>
              </div>
              <div className="border-t border-border pt-5">
                <FieldLabel>Accessibility features</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(catalogs.accessibilityFeatures || []).map(feat => {
                    const selected = dietaryState.accessibility.includes(feat.id)
                    return <button key={feat.id} type="button" role="checkbox" aria-checked={selected} onClick={() => setDietaryState(d => ({ ...d, accessibility: selected ? d.accessibility.filter(id => id !== feat.id) : [...d.accessibility, feat.id] }))} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${selected ? "border-primary bg-primary/5" : "border-border bg-background text-muted-foreground"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>{feat.label}</button>
                  })}
                </div>
              </div>
            </PropertyProfileSection>
          )}

          {/* ==================== Hotel: Arrival & Departure ==================== */}
          {isHotel && arrival && (
            <PropertyProfileSection
            id="arrival-departure"
            title="Arrival & Departure"
            description={`Times are interpreted in ${arrival.timezone}.`}
            icon={<Clock3 className="h-5 w-5" />}
            saving={savingSection === "arrival-departure"}
            saved={savedSection === "arrival-departure"}
            onSave={() => void saveSection("arrival-departure", arrival)}
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4">
                <h3 className="font-black">Check-in</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div><FieldLabel>From</FieldLabel><TimeSelect label="Check-in from" value={arrival.checkInFrom} onChange={value => setArrival(current => ({ ...current, checkInFrom: value }))} /></div>
                  <div><FieldLabel>Until</FieldLabel><TimeSelect label="Check-in until" value={arrival.checkInUntil} onChange={value => setArrival(current => ({ ...current, checkInUntil: value }))} /></div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <h3 className="font-black">Check-out</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div><FieldLabel>From</FieldLabel><TimeSelect label="Check-out from" value={arrival.checkOutFrom} onChange={value => setArrival(current => ({ ...current, checkOutFrom: value }))} /></div>
                  <div><FieldLabel>Until</FieldLabel><TimeSelect label="Check-out until" value={arrival.checkOutUntil} onChange={value => setArrival(current => ({ ...current, checkOutUntil: value }))} /></div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>The existing hotel check-in and check-out defaults remain the canonical operational times.</span></div>
          </PropertyProfileSection>
          )}

          <PropertyProfileSection
            id="policies"
            title={isHotel ? "Policies & House Rules" : "Guest Policies"}
            description={isHotel ? "Simple property-level rules. Cancellation terms remain with Rate Plans." : "Guest-facing policies shown in Discovery."}
            icon={<Building2 className="h-5 w-5" />}
            saving={savingSection === "policies"}
            saved={savedSection === "policies"}
            onSave={() => void saveSection("policies", policies)}
          >
            <div>
              <FieldLabel>Are children allowed?</FieldLabel>
              <ChoiceGroup ariaLabel="Children policy" value={policies.childrenAllowed} onChange={value => setPolicies(current => ({ ...current, childrenAllowed: value }))} options={[{ value: true, label: "Allowed" }, { value: false, label: "Not allowed" }, { value: null, label: "Not answered" }]} />
            </div>
            <div>
              <FieldLabel>Pets</FieldLabel>
              <ChoiceGroup ariaLabel="Pets policy" value={policies.petsPolicy} onChange={value => setPolicies(current => ({ ...current, petsPolicy: value }))} options={[{ value: "allowed", label: "Allowed" }, { value: "on_request", label: "Allowed on request" }, { value: "not_allowed", label: "Not allowed" }, { value: null, label: "Not answered" }]} />
            </div>
            {isFnb && (
              <div className="border-t border-border pt-5">
                <FieldLabel>Reservation advisory</FieldLabel>
                <ChoiceGroup
                  ariaLabel="Reservation policy"
                  value={policies.reservationPolicy ?? null}
                  onChange={value => setPolicies(current => ({ ...current, reservationPolicy: value }))}
                  options={[
                    ...(catalogs.reservationPolicies || []).map(rp => ({ value: rp.id, label: rp.label })),
                    { value: null, label: "Not specified" },
                  ]}
                />
                <p className="mt-2 text-xs text-muted-foreground">Advisory for Discovery. Does not affect the booking engine.</p>
              </div>
            )}
          </PropertyProfileSection>

          <PropertyProfileSection
            id="contact"
            title="Guest Contact"
            description="Public contact details — never owner account or billing information."
            icon={<Phone className="h-5 w-5" />}
            saving={isContactSaving}
            saved={savedSection === "contact"}
            onSave={() => void contactForm.handleSubmit(handleContactSubmit)()}
          >
            <div className="space-y-5" aria-busy={isContactSaving}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="property-phone" label="Phone" error={contactForm.formState.errors.phone?.message}>
                  {(controlProps) => (
                    <Input
                      {...contactForm.register("phone", { onChange: () => setContactError(null) })}
                      {...controlProps}
                      type="tel"
                      className={INPUT_CLASS}
                      placeholder="+356…"
                      maxLength={40}
                    />
                  )}
                </Field>
                <Field id="property-email" label="Email" error={contactForm.formState.errors.email?.message}>
                  {(controlProps) => (
                    <Input
                      {...contactForm.register("email", { onChange: () => setContactError(null) })}
                      {...controlProps}
                      type="email"
                      className={INPUT_CLASS}
                      placeholder="stay@example.com"
                      maxLength={254}
                    />
                  )}
                </Field>
              </div>
              <Field
                id="property-website"
                label={<><span>Website</span> <span className="font-medium text-muted-foreground">(optional)</span></>}
                error={contactForm.formState.errors.website?.message}
              >
                {(controlProps) => (
                  <Input
                    {...contactForm.register("website", { onChange: () => setContactError(null) })}
                    {...controlProps}
                    type="url"
                    className={INPUT_CLASS}
                    placeholder="https://www.example.com"
                    maxLength={2048}
                  />
                )}
              </Field>
              {isFnb && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="property-instagram" label={<><span>Instagram</span> <span className="font-medium text-muted-foreground">(optional)</span></>} error={contactForm.formState.errors.instagram?.message}>
                    {(controlProps) => (
                      <Input
                        {...contactForm.register("instagram", { onChange: () => setContactError(null) })}
                        {...controlProps}
                        className={INPUT_CLASS}
                        placeholder="@username"
                        maxLength={100}
                      />
                    )}
                  </Field>
                  <Field id="property-facebook" label={<><span>Facebook</span> <span className="font-medium text-muted-foreground">(optional)</span></>} error={contactForm.formState.errors.facebook?.message}>
                    {(controlProps) => (
                      <Input
                        {...contactForm.register("facebook", { onChange: () => setContactError(null) })}
                        {...controlProps}
                        type="url"
                        className={INPUT_CLASS}
                        placeholder="https://facebook.com/…"
                        maxLength={255}
                      />
                    )}
                  </Field>
                </div>
              )}
              {contactError ? <FormNotice>{contactError}</FormNotice> : null}
            </div>
          </PropertyProfileSection>
        </div>

        <aside className="h-fit rounded-3xl border border-border bg-card p-5 shadow-sm xl:sticky xl:top-28">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" /></div>
            <div><h2 className="font-black">Profile completeness</h2><p className="text-xs text-muted-foreground">Complete at your own pace.</p></div>
          </div>
          <div className="mt-5 space-y-2">
            {completeness?.checklist.map(item => (
              <a key={item.id} href={`#${item.id.replaceAll("_", "-")}`} className="flex items-start gap-2 rounded-xl p-2 text-sm transition-colors hover:bg-secondary/50">
                {item.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />}
                <span className={item.complete ? "font-bold text-foreground" : "text-muted-foreground"}>{item.label}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${item.category === "required" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{item.category}</span>
              </a>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">An incomplete profile never blocks {isHotel ? "reservations or normal PMS operation" : "ordering, QR scans, or payments"}.</div>
        </aside>
      </div>
    </div>
  )
}
