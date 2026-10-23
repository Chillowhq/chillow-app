"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import {
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import { apiClient } from "@/lib/axios-config"
import { toast } from "sonner"
import type {
  HotelBedConfiguration,
  HotelRoomType,
  HotelRoomTypeCreatePayload,
} from "@/types/hotel-room-type"
import {
  hotelRoomTypeWizardDefaultValues,
  hotelRoomTypeWizardSchema,
  normalizeHotelRoomTypeName,
  type HotelRoomTypeWizardFormValues,
} from "./HotelRoomTypeWizard.validation"

const STEPS = ["Details", "Guests & Beds", "Amenities", "Photos", "Review"]
const BED_TYPES = ["Single", "Twin", "Double", "Queen", "King", "Sofa Bed", "Bunk Bed"]
const AMENITIES = [
  "Free WiFi",
  "Air Conditioning",
  "TV",
  "Desk",
  "Coffee Maker",
  "Kettle",
  "Mini Bar",
  "Refrigerator",
  "Safe",
  "Kitchenette",
  "Balcony",
  "Bathtub",
]
const VIEWS = ["Ocean View", "Sea View", "City View", "Garden View", "Pool View", "Mountain View", "Courtyard View"]
const FALLBACK_NAME_SUGGESTIONS = ["Standard", "Superior", "Deluxe", "Executive", "Junior Suite", "Suite", "Villa", "Apartment"]
const CUSTOM_ROOM_TYPE_NAME = "__custom_room_type__"

function requestKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `room-type:${crypto.randomUUID()}`
    : `room-type:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function bedSummary(beds: HotelBedConfiguration[]) {
  if (!beds.length) return "No bed configuration"
  return beds.map((bed) => `${bed.count} ${bed.bedType}${bed.count === 1 ? " bed" : " beds"}`).join(" Ãƒâ€šÃ‚Â· ")
}

function defaultBeds() {
  return [{ bedType: "King", count: 1 }]
}

function initialFormValues(roomType: HotelRoomType | null): HotelRoomTypeWizardFormValues {
  if (!roomType) return hotelRoomTypeWizardDefaultValues

  return {
    name: roomType.name,
    description: roomType.description || "",
    roomSize: roomType.roomSize == null ? "" : String(roomType.roomSize),
    roomSizeUnit: roomType.roomSizeUnit || "m2",
    maxGuests: String(roomType.maxGuests || 2),
    viewType: roomType.viewType || "",
    amenities: [...(roomType.amenities || [])],
  }
}

export function HotelRoomTypeWizard({
  open,
  onOpenChange,
  onCreated,
  onAddRoomNow,
  onViewRoomTypes,
  roomType = null,
  nameSuggestions = FALLBACK_NAME_SUGGESTIONS,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (roomType: HotelRoomType) => void
  onAddRoomNow: (roomType: HotelRoomType) => void
  onViewRoomTypes: () => void
  roomType?: HotelRoomType | null
  nameSuggestions?: string[]
}) {
  const form = useForm<HotelRoomTypeWizardFormValues>({
    resolver: zodResolver(hotelRoomTypeWizardSchema),
    defaultValues: hotelRoomTypeWizardDefaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
  const values = useWatch({
    control: form.control,
    defaultValue: hotelRoomTypeWizardDefaultValues,
  }) as HotelRoomTypeWizardFormValues
  const [step, setStep] = useState(0)
  const [bedConfiguration, setBedConfiguration] = useState<HotelBedConfiguration[]>(defaultBeds)
  const [images, setImages] = useState<string[]>([])
  const [formNotice, setFormNotice] = useState("")
  const [bedError, setBedError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [created, setCreated] = useState<HotelRoomType | null>(null)
  const [nameChoice, setNameChoice] = useState("")
  const idempotencyKey = useRef(requestKey())
  const fileInput = useRef<HTMLInputElement>(null)
  const nameTrigger = useRef<HTMLButtonElement>(null)
  const saveInFlight = useRef(false)
  const isEditing = Boolean(roomType)

  useEffect(() => {
    if (!open) return

    form.reset(initialFormValues(roomType))
    setBedConfiguration(roomType?.bedConfiguration?.length
      ? roomType.bedConfiguration.map((bed) => ({ ...bed }))
      : defaultBeds())
    setImages([...(roomType?.images || [])])
    setStep(0)
    setNameChoice(roomType ? roomType.name : "")
    setFormNotice("")
    setBedError("")
    setCreated(null)
    idempotencyKey.current = requestKey()
  }, [form, open, roomType])

  const payload = useMemo<HotelRoomTypeCreatePayload>(() => ({
    name: normalizeHotelRoomTypeName(values.name),
    description: values.description.trim(),
    roomSize: values.roomSize ? Number(values.roomSize) : null,
    roomSizeUnit: values.roomSizeUnit,
    maxGuests: Number(values.maxGuests),
    bedConfiguration,
    viewType: values.viewType,
    amenities: values.amenities,
    images,
  }), [bedConfiguration, images, values])

  function validateBeds() {
    return bedConfiguration.some((bed) => !bed.bedType || !Number.isInteger(bed.count) || bed.count < 1)
      ? "Each bed needs a type and positive quantity."
      : ""
  }

  async function goNext() {
    if (step === 0) {
      const isValid = await form.trigger(["name", "roomSize"], { shouldFocus: true })
      if (!isValid) {
        if (!normalizeHotelRoomTypeName(form.getValues("name"))) {
          requestAnimationFrame(() => nameTrigger.current?.focus())
        }
        return
      }
    }

    if (step === 1) {
      const hasValidGuests = await form.trigger("maxGuests", { shouldFocus: true })
      const nextBedError = validateBeds()
      setBedError(nextBedError)
      if (!hasValidGuests || nextBedError) return
    }

    setFormNotice("")
    setStep((current) => Math.min(STEPS.length - 1, current + 1))
  }

  function addBed() {
    const used = new Set(bedConfiguration.map((bed) => bed.bedType))
    const bedType = BED_TYPES.find((type) => !used.has(type))
    if (!bedType) return
    setBedConfiguration((current) => [...current, { bedType, count: 1 }])
    setBedError("")
  }

  function updateBed(index: number, patch: Partial<HotelBedConfiguration>) {
    setBedConfiguration((current) => current.map((bed, bedIndex) =>
      bedIndex === index ? { ...bed, ...patch } : bed,
    ))
    setBedError("")
  }

  function toggleAmenity(amenity: string) {
    const currentAmenities = form.getValues("amenities")
    form.setValue(
      "amenities",
      currentAmenities.includes(amenity)
        ? currentAmenities.filter((item) => item !== amenity)
        : [...currentAmenities, amenity],
      { shouldDirty: true },
    )
  }

  async function uploadPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    if (images.length + files.length > 6) {
      setFormNotice("A room type can have up to 6 photos.")
      event.target.value = ""
      return
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setFormNotice("Each photo must be 10 MB or smaller.")
      event.target.value = ""
      return
    }

    setIsUploading(true)
    setFormNotice("")
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const body = new FormData()
        body.append("image", file)
        body.append("folder", "quickserve/hotel-room-types")
        const response = await apiClient.post<{ url?: string }>("/upload/image", body, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        if (!response.data.url) throw new Error("Upload did not return an image URL")
        uploaded.push(response.data.url)
      }
      setImages((current) => [...current, ...uploaded])
    } catch (uploadError) {
      console.error("Room type photo upload failed", uploadError)
      setFormNotice("Photos could not be uploaded. Please try again.")
    } finally {
      setIsUploading(false)
      event.target.value = ""
    }
  }

  async function saveRoomType() {
    if (saveInFlight.current) return

    const hasValidForm = await form.trigger(["name", "roomSize", "maxGuests"], { shouldFocus: true })
    const nextBedError = validateBeds()
    setBedError(nextBedError)
    if (!hasValidForm || nextBedError) {
      setFormNotice("Please correct the highlighted fields before creating the room type.")
      return
    }

    saveInFlight.current = true
    setIsSaving(true)
    setFormNotice("")
    try {
      const response = isEditing
        ? await apiClient.patch<{ roomType: HotelRoomType }>("/business/room-types", {
            ...payload,
            currentName: roomType?.name,
          })
        : await apiClient.post<{ roomType: HotelRoomType }>(
            "/business/room-types",
            payload,
            { headers: { "Idempotency-Key": idempotencyKey.current } },
          )
      onCreated(response.data.roomType)
      if (isEditing) {
        toast.success(`${response.data.roomType.name} updated`)
        onOpenChange(false)
      } else {
        setCreated(response.data.roomType)
      }
    } catch (saveError: any) {
      setFormNotice(saveError.response?.data?.message || `Room type could not be ${isEditing ? "updated" : "created"}. Please try again.`)
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && !isUploading && onOpenChange(next)}>
      <DialogContent
        aria-busy={isSaving || isUploading || undefined}
        className="grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[90dvh]"
      >
        {created ? (
          <div className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-10 text-center sm:px-12">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Check className="size-8" aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-primary">Room Type Created</p>
            <DialogTitle className="mt-2 text-2xl font-black">{created.name}</DialogTitle>
            <DialogDescription className="mt-2">Your room type has been created.</DialogDescription>
            <div className="mt-7 w-full max-w-lg rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left dark:border-sky-900 dark:bg-sky-950/30">
              <p className="font-bold text-foreground">What&apos;s next?</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                You can now add individual rooms (Service Points) for this room type.
              </p>
            </div>
            <div className="mt-6 grid w-full max-w-lg gap-3">
              <Button className="h-11" onClick={() => onAddRoomNow(created)}>Add a room now</Button>
              <Button variant="outline" className="h-11" onClick={onViewRoomTypes}>View room types</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="border-b border-border px-5 py-5 pr-12 sm:px-6">
              <DialogTitle>{isEditing ? `Edit ${roomType?.name}` : "Create New Room Type"}</DialogTitle>
              <DialogDescription>{isEditing ? "Update the reusable defaults for future rooms of this type." : "Define a reusable template for individual room ServicePoints."}</DialogDescription>
              <ol className="mt-4 grid grid-cols-5" aria-label="Room type creation progress">
                {STEPS.map((label, index) => (
                  <li key={label} className="relative flex flex-col items-center gap-1 text-center">
                    {index > 0 ? <span className="absolute right-1/2 top-3.5 -z-0 h-px w-full bg-border" /> : null}
                    <span className={`relative z-10 flex size-7 items-center justify-center rounded-full border text-xs font-black ${index <= step ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}>
                      {index + 1}
                    </span>
                    <span className={`hidden text-[10px] font-bold sm:block ${index === step ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
                  </li>
                ))}
              </ol>
            </DialogHeader>

            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
              {step === 0 ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-black">Basic information</h3>
                    <p className="text-sm text-muted-foreground">What owners and guests use to understand this room category.</p>
                  </div>
                  {isEditing ? (
                    <Field id="room-type-name" label="Room type name" required>
                      {(controlProps) => <Input {...controlProps} value={values.name} disabled />}
                    </Field>
                  ) : (
                    <div className="space-y-2">
                      <Field
                        id="room-type-name"
                        label="Room type name"
                        required
                        error={nameChoice === CUSTOM_ROOM_TYPE_NAME ? undefined : form.formState.errors.name?.message}
                      >
                        {(controlProps) => (
                          <Select
                            value={nameChoice}
                            onValueChange={(value) => {
                              setNameChoice(value)
                              form.setValue("name", value === CUSTOM_ROOM_TYPE_NAME ? "" : value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }}
                          >
                            <SelectTrigger ref={nameTrigger} {...controlProps} aria-label="Choose a Room Type name"><SelectValue placeholder="Choose a Room Type name" /></SelectTrigger>
                            <SelectContent>
                              {nameSuggestions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                              <SelectItem value={CUSTOM_ROOM_TYPE_NAME}>Create a custom Room Type</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </Field>
                      {nameChoice === CUSTOM_ROOM_TYPE_NAME ? (
                        <Field id="custom-room-type-name" label="Custom Room Type name *" error={form.formState.errors.name?.message}>
                          {(controlProps) => <Input {...controlProps} {...form.register("name")} aria-required="true" maxLength={80} placeholder="e.g. Deluxe Ocean King" autoFocus />}
                        </Field>
                      ) : null}
                    </div>
                  )}
                  <Field id="room-type-description" label="Description" error={form.formState.errors.description?.message}>
                    {(controlProps) => (
                      <>
                        <Textarea {...controlProps} {...form.register("description")} maxLength={500} className="min-h-28" placeholder="Describe the room type, its features and what makes it special..." />
                        <p className="text-right text-xs text-muted-foreground">{values.description.length}/500</p>
                      </>
                    )}
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                    <Field id="room-size" label="Room size (optional)" error={form.formState.errors.roomSize?.message}>
                      {(controlProps) => <Input {...controlProps} {...form.register("roomSize")} type="number" min="0" placeholder="e.g. 32" />}
                    </Field>
                    <Field id="room-size-unit" label="Unit">
                      {(controlProps) => (
                        <Select value={values.roomSizeUnit} onValueChange={(value: "m2" | "ft2") => form.setValue("roomSizeUnit", value, { shouldDirty: true })}>
                          <SelectTrigger {...controlProps}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="m2">mÃƒâ€šÃ‚Â²</SelectItem><SelectItem value="ft2">ftÃƒâ€šÃ‚Â²</SelectItem></SelectContent>
                        </Select>
                      )}
                    </Field>
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-black">Guests &amp; beds</h3>
                    <p className="text-sm text-muted-foreground">These defaults are copied to newly created rooms and remain compatible with availability.</p>
                  </div>
                  <Field id="room-type-guests" label="Maximum guests" required error={form.formState.errors.maxGuests?.message}>
                    {(controlProps) => (
                      <div className="flex w-full max-w-xs items-center rounded-xl border border-border">
                        <Button type="button" variant="ghost" size="icon" aria-label="Decrease maximum guests" onClick={() => form.setValue("maxGuests", String(Math.max(1, Number(form.getValues("maxGuests") || 1) - 1)), { shouldDirty: true, shouldValidate: true })}><Minus /></Button>
                        <Input {...controlProps} {...form.register("maxGuests")} type="number" min="1" className="border-0 text-center font-bold shadow-none" />
                        <Button type="button" variant="ghost" size="icon" aria-label="Increase maximum guests" onClick={() => form.setValue("maxGuests", String(Number(form.getValues("maxGuests") || 0) + 1), { shouldDirty: true, shouldValidate: true })}><Plus /></Button>
                      </div>
                    )}
                  </Field>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3"><Label>Bed configuration</Label><Button type="button" variant="outline" size="sm" onClick={addBed} disabled={bedConfiguration.length >= BED_TYPES.length}><Plus /> Add bed</Button></div>
                    {bedConfiguration.length ? bedConfiguration.map((bed, index) => (
                      <div key={`${bed.bedType}-${index}`} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-center gap-2 rounded-xl border border-border p-3">
                        <Select value={bed.bedType} onValueChange={(value) => updateBed(index, { bedType: value })}>
                          <SelectTrigger aria-label={`Bed type ${index + 1}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{BED_TYPES.map((type) => <SelectItem key={type} value={type} disabled={bedConfiguration.some((item, itemIndex) => itemIndex !== index && item.bedType === type)}>{type}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" min="1" value={bed.count} aria-label={`Quantity for ${bed.bedType}`} onChange={(event) => updateBed(index, { count: Math.max(1, Number(event.target.value) || 1) })} />
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${bed.bedType}`} onClick={() => { setBedConfiguration((current) => current.filter((_, itemIndex) => itemIndex !== index)); setBedError("") }}><Trash2 /></Button>
                      </div>
                    )) : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No bed configuration added.</p>}
                    {bedError ? <FormNotice>{bedError}</FormNotice> : null}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div><h3 className="text-lg font-black">View &amp; amenities</h3><p className="text-sm text-muted-foreground">Room-type features only; property-level facilities stay in Property Profile.</p></div>
                  <Field id="room-type-view" label="Default view">
                    {(controlProps) => (
                      <Select value={values.viewType || "none"} onValueChange={(value) => form.setValue("viewType", value === "none" ? "" : value, { shouldDirty: true })}>
                        <SelectTrigger {...controlProps}><SelectValue placeholder="No specific view" /></SelectTrigger>
                        <SelectContent><SelectItem value="none">No specific view</SelectItem>{VIEWS.map((view) => <SelectItem key={view} value={view}>{view}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </Field>
                  <div className="space-y-3"><Label>Popular amenities</Label><div className="grid gap-2 sm:grid-cols-2">{AMENITIES.map((amenity) => { const checked = values.amenities.includes(amenity); return <button key={amenity} type="button" role="checkbox" aria-checked={checked} onClick={() => toggleAmenity(amenity)} className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold ${checked ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}><span className={`flex size-5 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{checked ? <Check className="size-3" /> : null}</span>{amenity}</button> })}</div></div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-5">
                  <div><h3 className="text-lg font-black">Room photos</h3><p className="text-sm text-muted-foreground">The first photo becomes the Room Type cover and can be inherited by room cards.</p></div>
                  <button type="button" disabled={isUploading || images.length >= 6} onClick={() => fileInput.current?.click()} className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 p-6 text-center hover:border-primary hover:bg-primary/5 disabled:opacity-50">
                    {isUploading ? <Loader2 className="size-8 animate-spin text-primary" /> : <ImagePlus className="size-8 text-primary" />}
                    <span className="mt-3 font-bold">{isUploading ? "Uploading photos..." : "Choose room photos"}</span>
                    <span className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP Ãƒâ€šÃ‚Â· Max 10 MB each Ãƒâ€šÃ‚Â· Up to 6</span>
                  </button>
                  <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadPhotos} />
                  {images.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{images.map((image, index) => <div key={`${image}-${index}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted"><img src={image} alt={`Room type photo ${index + 1}`} className="size-full object-cover" />{index === 0 ? <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">Cover</span> : null}<Button type="button" variant="destructive" size="icon-sm" className="absolute right-2 top-2" aria-label={`Remove photo ${index + 1}`} onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}><Trash2 /></Button></div>)}</div> : null}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  <div><h3 className="text-lg font-black">Review and create</h3><p className="text-sm text-muted-foreground">Check the template before creating it. Backend validation remains authoritative.</p></div>
                  <section className="overflow-hidden rounded-2xl border border-border">
                    {images[0] ? <img src={images[0]} alt="" className="h-40 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-muted text-muted-foreground"><ImagePlus className="size-8" /></div>}
                    <div className="space-y-4 p-4"><div><p className="text-xl font-black">{payload.name}</p><p className="text-sm text-muted-foreground">{payload.description || "No description"}</p></div><dl className="grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-xl bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">Guests</dt><dd className="mt-1 flex items-center gap-2 font-bold"><Users className="size-4" />Up to {payload.maxGuests}</dd></div><div className="rounded-xl bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">Beds</dt><dd className="mt-1 flex items-center gap-2 font-bold"><BedDouble className="size-4" />{bedSummary(payload.bedConfiguration)}</dd></div><div className="rounded-xl bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">Room size</dt><dd className="mt-1 font-bold">{payload.roomSize == null ? "Not set" : `${payload.roomSize} ${payload.roomSizeUnit === "m2" ? "mÃƒâ€šÃ‚Â²" : "ftÃƒâ€šÃ‚Â²"}`}</dd></div><div className="rounded-xl bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">View</dt><dd className="mt-1 font-bold">{payload.viewType || "Not set"}</dd></div></dl>{payload.amenities.length ? <div className="flex flex-wrap gap-2">{payload.amenities.map((amenity) => <span key={amenity} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{amenity}</span>)}</div> : null}</div>
                  </section>
                </div>
              ) : null}

              {formNotice ? <FormNotice className="mt-5">{formNotice}</FormNotice> : null}
            </div>

            <DialogFooter className="flex-row items-center justify-between border-t border-border px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={() => step === 0 ? onOpenChange(false) : setStep((current) => current - 1)} disabled={isSaving || isUploading}><ChevronLeft />{step === 0 ? "Cancel" : "Back"}</Button>
              <Button type="button" onClick={() => step === STEPS.length - 1 ? void saveRoomType() : void goNext()} disabled={isSaving || isUploading}>{isSaving ? <Loader2 className="animate-spin" /> : step === STEPS.length - 1 ? <Sparkles /> : null}{step === STEPS.length - 1 ? isEditing ? "Save Room Type" : "Create Room Type" : "Continue"}{step < STEPS.length - 1 ? <ChevronRight /> : null}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
