"use client"

import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import * as Select from "@radix-ui/react-select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  ImagePlus,
  Trash2,
  Bed,
  Users,
  Euro,
  Info,
  Plus,
  ChevronDown,
  Eye,
  X,
  Check,
} from "lucide-react"
import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import { apiClient } from "@/lib/axios-config"
import type {
  ServicePoint,
  ServicePointFormPayload,
  ServicePointModalProps,
} from "@/types/service-point"
import type { HotelRoomType } from "@/types/hotel-room-type"
import { ServicePointModalFoundation } from "./ServicePointModalFoundation"
import {
  HOTEL_SERVICE_POINT_BED_TYPES,
  hotelServicePointEditDefaultValues,
  hotelServicePointEditSchema,
  normalizeHotelServicePointText,
  type HotelServicePointEditFormValues,
} from "./HotelServicePointModal.validation"

const PRESET_AMENITIES = [
  "Free WiFi", "TV", "Air Conditioning", "Balcony", "Mini Bar", "Ocean View", "City View", "Bathtub", "Coffee Maker",
]

const VIEW_SUGGESTIONS = [
  "City View", "Ocean View", "Sea View", "Garden View", "Pool View", "Mountain View", "Courtyard View", "No Specific View",
]

type BedFieldErrors = Array<{
  bedType?: { message?: string }
  count?: { message?: string }
}>

function roomTypeKey(value: string) {
  return normalizeHotelServicePointText(value).toLowerCase()
}

function initialFormValues(initialData: ServicePoint | null): HotelServicePointEditFormValues {
  if (!initialData) return hotelServicePointEditDefaultValues

  return {
    label: initialData.label || "",
    code: initialData.code || "",
    roomType: initialData.roomType || "",
    maxGuests: initialData.maxGuests != null
      ? String(initialData.maxGuests)
      : initialData.capacity != null ? String(initialData.capacity) : "",
    pricePerNight: initialData.pricePerNight != null
      ? String(initialData.pricePerNight)
      : "",
    bedConfiguration: initialData.bedConfiguration?.length
      ? initialData.bedConfiguration.map((bed) => ({ ...bed }))
      : [],
    viewType: initialData.viewType || "",
    amenities: [...(initialData.amenities || [])],
    images: [...(initialData.images || [])],
    description: initialData.fullDescription || initialData.description || "",
  }
}

function legacyBedsValue(initialData: ServicePoint | null) {
  return initialData?.beds ? String(initialData.beds) : ""
}

function firstInvalidBedIndex(beds: HotelServicePointEditFormValues["bedConfiguration"]) {
  const seenBedTypes = new Set<string>()

  return beds.findIndex((bed) => {
    const key = bed.bedType.trim().toLowerCase()
    const invalidCount = typeof bed.count !== "number"
      || !Number.isInteger(bed.count)
      || bed.count < 1
    if (!key || invalidCount || seenBedTypes.has(key)) return true
    seenBedTypes.add(key)
    return false
  })
}

export function HotelServicePointModal({
  isOpen,
  onClose,
  isEditing,
  initialData,
  onSave,
  term,
  canManageRoomTypes = true,
}: ServicePointModalProps & { canManageRoomTypes?: boolean }) {
  const form = useForm<HotelServicePointEditFormValues>({
    resolver: zodResolver(hotelServicePointEditSchema),
    defaultValues: hotelServicePointEditDefaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
  const values = useWatch({
    control: form.control,
    defaultValue: hotelServicePointEditDefaultValues,
  }) as HotelServicePointEditFormValues
  const [formNotice, setFormNotice] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [hotelRoomTypes, setHotelRoomTypes] = useState<HotelRoomType[]>([])
  const [isAddingRoomType, setIsAddingRoomType] = useState(false)
  const [newRoomTypeName, setNewRoomTypeName] = useState("")
  const [isUpdatingRoomTypes, setIsUpdatingRoomTypes] = useState(false)
  const [bedConfigurationTouched, setBedConfigurationTouched] = useState(false)
  const [legacyBeds, setLegacyBeds] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const roomTypeTriggerRef = useRef<HTMLButtonElement>(null)
  const maxGuestsInputRef = useRef<HTMLInputElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)
  const bedTypeRefs = useRef<Array<HTMLSelectElement | null>>([])
  const saveInFlightRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return

    form.reset(initialFormValues(initialData))
    setLegacyBeds(legacyBedsValue(initialData))
    setFormNotice("")
    setIsAddingRoomType(false)
    setNewRoomTypeName("")
    setBedConfigurationTouched(false)
  }, [form, initialData, isOpen])

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setHotelRoomTypes([])

    apiClient.get("/business/settings").then((res) => {
      if (cancelled) return
      const roomTypes = res.data?.hotelRoomTypes || []
      setHotelRoomTypes(
        roomTypes
          .filter((roomType: HotelRoomType) => roomType.active)
          .sort((first: HotelRoomType, second: HotelRoomType) => first.sortOrder - second.sortOrder),
      )
    }).catch(() => {
      if (!cancelled) {
        setFormNotice("Room types could not be loaded. Please close the form and try again.")
      }
    })

    return () => {
      cancelled = true
    }
  }, [isOpen])

  function updateValue<Name extends keyof HotelServicePointEditFormValues>(
    name: Name,
    value: HotelServicePointEditFormValues[Name],
  ) {
    form.setValue(name, value as never, {
      shouldDirty: true,
      shouldValidate: Boolean(form.formState.errors[name]),
    } as never)
  }

  function clearNotice() {
    if (formNotice) setFormNotice("")
  }

  function focusFirstInvalidField(formValues: HotelServicePointEditFormValues) {
    if (!normalizeHotelServicePointText(formValues.label)) {
      labelInputRef.current?.focus()
      return
    }
    if (!normalizeHotelServicePointText(formValues.code)) {
      codeInputRef.current?.focus()
      return
    }
    if (!normalizeHotelServicePointText(formValues.roomType)) {
      roomTypeTriggerRef.current?.focus()
      return
    }
    const maxGuests = Number(formValues.maxGuests)
    if (!Number.isInteger(maxGuests) || maxGuests < 1) {
      maxGuestsInputRef.current?.focus()
      return
    }
    const pricePerNight = Number(formValues.pricePerNight)
    if (!formValues.pricePerNight.trim() || !Number.isFinite(pricePerNight) || pricePerNight < 0) {
      priceInputRef.current?.focus()
      return
    }
    const bedIndex = firstInvalidBedIndex(formValues.bedConfiguration)
    if (bedIndex >= 0) bedTypeRefs.current[bedIndex]?.focus()
  }

  async function handleSave() {
    if (saveInFlightRef.current) return

    const isValid = await form.trigger(undefined, { shouldFocus: false })
    const formValues = form.getValues()
    if (!isValid) {
      setFormNotice("Please correct the highlighted fields before saving room details.")
      requestAnimationFrame(() => focusFirstInvalidField(formValues))
      return
    }

    const normalizedBedConfiguration = formValues.bedConfiguration.map((bed) => ({
      bedType: bed.bedType.trim(),
      count: Number(bed.count),
    }))
    const payload: ServicePointFormPayload = {
      label: formValues.label.trim(),
      code: formValues.code.trim(),
      roomType: normalizeHotelServicePointText(formValues.roomType),
      pricePerNight: Number(formValues.pricePerNight),
      currency: "eur",
      description: formValues.description.trim(),
      amenities: formValues.amenities,
      images: formValues.images,
      capacity: Number(formValues.maxGuests),
      maxGuests: Number(formValues.maxGuests),
      viewType: formValues.viewType.trim() || null,
    }

    if (bedConfigurationTouched || normalizedBedConfiguration.length > 0) {
      payload.bedConfiguration = normalizedBedConfiguration
    } else if (legacyBeds) {
      payload.beds = Number(legacyBeds)
    }

    saveInFlightRef.current = true
    setIsSaving(true)
    setFormNotice("")
    try {
      await onSave(payload)
      onClose()
    } catch (error: any) {
      setFormNotice(error.response?.data?.error || "Failed to save room details")
    } finally {
      saveInFlightRef.current = false
      setIsSaving(false)
    }
  }

  function toggleAmenity(amenity: string) {
    updateValue(
      "amenities",
      values.amenities.includes(amenity)
        ? values.amenities.filter((current) => current !== amenity)
        : [...values.amenities, amenity],
    )
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (values.images.length >= 3) {
      setFormNotice("Maximum 3 images allowed")
      return
    }

    try {
      setIsUploading(true)
      setFormNotice("")
      const formData = new FormData()
      formData.append("image", file)
      formData.append("folder", "quickserve/hotel-rooms")

      const response = await apiClient.post("/upload/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      if (response.data?.url) {
        updateValue("images", [...form.getValues("images"), response.data.url])
      }
    } catch (error) {
      console.error("Upload error", error)
      setFormNotice("Failed to upload image. Please try again.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function removeImage(index: number) {
    updateValue("images", values.images.filter((_, currentIndex) => currentIndex !== index))
  }

  function handleSelectRoomType(name: string) {
    updateValue("roomType", name)
    clearNotice()
  }

  async function handleAddRoomType() {
    const normalizedName = normalizeHotelServicePointText(newRoomTypeName)
    if (!normalizedName) {
      setFormNotice("Room type name is required")
      return
    }
    if (normalizedName.length > 80) {
      setFormNotice("Room type name must not exceed 80 characters")
      return
    }
    if (hotelRoomTypes.some((roomType) => roomTypeKey(roomType.name) === roomTypeKey(normalizedName))) {
      setFormNotice("A room type with this name already exists")
      return
    }

    try {
      setIsUpdatingRoomTypes(true)
      setFormNotice("")
      const response = await apiClient.post("/business/room-types", { name: normalizedName })
      const created = response.data?.roomType
      if (created) {
        setHotelRoomTypes((current) => [...current, created].sort((first, second) => first.sortOrder - second.sortOrder))
        updateValue("roomType", created.name)
      }
      setIsAddingRoomType(false)
      setNewRoomTypeName("")
    } catch (error: any) {
      console.error("[handleAddRoomType]", error)
      setFormNotice(error.response?.data?.message || "Failed to add room type")
    } finally {
      setIsUpdatingRoomTypes(false)
    }
  }

  async function handleRemoveRoomType() {
    if (!values.roomType) return

    const selectedRoomType = hotelRoomTypes.find(
      (roomType) => roomTypeKey(roomType.name) === roomTypeKey(values.roomType),
    )
    if (!selectedRoomType || selectedRoomType.isDefault) return

    const roomTypeName = selectedRoomType.name
    if (!confirm(`Are you sure you want to remove the room type "${roomTypeName}"?`)) return

    try {
      setIsUpdatingRoomTypes(true)
      setFormNotice("")
      const response = await apiClient.delete("/business/room-types", {
        params: { name: roomTypeName },
      })

      if (response.data?.deactivated || response.data?.removed) {
        setHotelRoomTypes((current) => current.filter(
          (roomType) => roomTypeKey(roomType.name) !== roomTypeKey(roomTypeName),
        ))
      }

      if (response.data?.removed && roomTypeKey(values.roomType) === roomTypeKey(roomTypeName)) {
        updateValue("roomType", "")
      }
    } catch (error: any) {
      console.error("[handleRemoveRoomType]", error)
      setFormNotice(error.response?.data?.message || "Failed to remove room type")
    } finally {
      setIsUpdatingRoomTypes(false)
    }
  }

  function addBedEntry() {
    const usedBedTypes = new Set(values.bedConfiguration.map((bed) => bed.bedType.toLowerCase()))
    const nextBedType = HOTEL_SERVICE_POINT_BED_TYPES.find((bedType) => !usedBedTypes.has(bedType.toLowerCase()))
    if (!nextBedType) {
      setFormNotice("All available bed types have already been added")
      return
    }
    setBedConfigurationTouched(true)
    updateValue("bedConfiguration", [...values.bedConfiguration, { bedType: nextBedType, count: 1 }])
  }

  function updateBedEntry(index: number, field: "bedType" | "count", value: string | number) {
    setBedConfigurationTouched(true)
    const updated = [...values.bedConfiguration]
    if (field === "bedType") {
      updated[index] = { ...updated[index], bedType: value as string }
    } else if (value === "") {
      updated[index] = { ...updated[index], count: "" }
    } else {
      const count = Number(value)
      updated[index] = {
        ...updated[index],
        count: Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1,
      }
    }
    updateValue("bedConfiguration", updated)
  }

  function removeBedEntry(index: number) {
    setBedConfigurationTouched(true)
    updateValue("bedConfiguration", values.bedConfiguration.filter((_, currentIndex) => currentIndex !== index))
  }

  const selectedRoomType = hotelRoomTypes.find(
    (roomType) => roomTypeKey(roomType.name) === roomTypeKey(values.roomType),
  )
  const canRemoveRoomType = Boolean(selectedRoomType && !selectedRoomType.isDefault)
  const showLegacyRoomType = Boolean(values.roomType && !selectedRoomType)
  const selectedRoomTypeValue = selectedRoomType?.name || values.roomType || ""
  const bedErrors = form.formState.errors.bedConfiguration as unknown as BedFieldErrors | undefined

  return (
    <ServicePointModalFoundation
      isOpen={isOpen}
      onClose={onClose}
      isEditing={isEditing}
      term={term}
      description={<>Configure the details, classification, pricing, and media for this room.</>}
      formError=""
      errorVariant="panel"
      isSaving={isSaving}
      isBusy={isSaving || isUploading || isUpdatingRoomTypes}
      onSubmit={() => void handleSave()}
      contentClassName="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
      bodyClassName="space-y-6 py-4"
      footerClassName="mt-4 pt-4 border-t border-border"
      submitClassName="min-w-[120px]"
    >
      <div aria-busy={isSaving || isUploading || isUpdatingRoomTypes || undefined} className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">Room Identity</h3>
          <div className="h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field id="label" label="Room Name / Label" required error={form.formState.errors.label?.message}>
            {(controlProps) => (
              <Input
                {...controlProps}
                ref={labelInputRef}
                value={values.label}
                onChange={(event) => {
                  updateValue("label", event.target.value.replace(/^(\s*)(\S)/, (_, spaces, first) => `${spaces}${first.toUpperCase()}`))
                  clearNotice()
                }}
                placeholder="e.g. Deluxe Ocean King"
              />
            )}
          </Field>
          <Field id="code" label="Room Number / Code" required error={form.formState.errors.code?.message}>
            {(controlProps) => (
              <Input
                {...controlProps}
                ref={codeInputRef}
                value={values.code}
                onChange={(event) => {
                  updateValue("code", event.target.value)
                  clearNotice()
                }}
                placeholder="e.g. 401"
              />
            )}
          </Field>
        </div>

        <div className="space-y-1 pt-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">Classification</h3>
          <div className="h-px bg-border" />
        </div>
        <div className="space-y-2">
          <div className="mb-1.5 flex items-end justify-between">
            <Label htmlFor="roomType">Room Type <span aria-hidden="true">*</span></Label>
            {canManageRoomTypes && !isAddingRoomType ? (
              <div className="flex items-center gap-3">
                {canRemoveRoomType ? (
                  <button
                    type="button"
                    onClick={() => void handleRemoveRoomType()}
                    className="flex items-center gap-1 text-[10px] font-bold text-destructive hover:underline"
                    title="Remove this custom room type"
                  >
                    <Trash2 className="size-3" /> Remove
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsAddingRoomType(true)}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                >
                  <Plus className="size-3" /> Add New
                </button>
              </div>
            ) : null}
          </div>

          {!isAddingRoomType ? (
            <Select.Root value={selectedRoomTypeValue} onValueChange={handleSelectRoomType} disabled={isUpdatingRoomTypes}>
              <Select.Trigger
                ref={roomTypeTriggerRef}
                id="roomType"
                type="button"
                aria-required="true"
                aria-invalid={form.formState.errors.roomType ? true : undefined}
                aria-describedby={form.formState.errors.roomType ? "roomType-error" : undefined}
                className="group flex h-[50px] w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left font-medium text-foreground shadow-sm transition-all outline-none hover:border-primary/40 focus:ring-2 focus:ring-primary/20 data-[state=open]:border-primary/50 data-[state=open]:ring-2 data-[state=open]:ring-primary/20"
              >
                <Select.Value placeholder="Select room type" />
                <Select.Icon asChild>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  position="popper"
                  sideOffset={6}
                  className="z-[60] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-card p-1 text-foreground shadow-2xl"
                >
                  <Select.Viewport className="max-h-64 overflow-y-auto">
                    {showLegacyRoomType ? (
                      <Select.Item
                        value={values.roomType}
                        className="relative flex cursor-pointer select-none rounded-lg py-2.5 pl-9 pr-3 text-sm font-semibold text-amber-600 outline-none transition-colors data-[highlighted]:bg-amber-50 dark:data-[highlighted]:bg-amber-950/30"
                      >
                        <Select.ItemIndicator className="absolute left-3 flex size-4 items-center justify-center text-amber-600">
                          <Check className="size-4" />
                        </Select.ItemIndicator>
                        <Select.ItemText>{values.roomType} (current)</Select.ItemText>
                      </Select.Item>
                    ) : null}
                    {hotelRoomTypes.map((roomType) => (
                      <Select.Item
                        key={roomType.name}
                        value={roomType.name}
                        className="relative flex cursor-pointer select-none rounded-lg py-2.5 pl-9 pr-3 text-sm font-semibold outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary data-[state=checked]:bg-secondary"
                      >
                        <Select.ItemIndicator className="absolute left-3 flex size-4 items-center justify-center text-primary">
                          <Check className="size-4" />
                        </Select.ItemIndicator>
                        <Select.ItemText>{roomType.name}</Select.ItemText>
                      </Select.Item>
                    ))}
                    {hotelRoomTypes.length === 0 && !showLegacyRoomType ? (
                      <div className="px-3 py-2.5 text-sm text-muted-foreground">No room types configured</div>
                    ) : null}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          ) : (
            <div className="flex w-full items-center gap-1.5">
              <input
                type="text"
                disabled={isUpdatingRoomTypes}
                value={newRoomTypeName}
                onChange={(event) => setNewRoomTypeName(event.target.value.replace(/^(\s*)(\S)/, (_, spaces, first) => `${spaces}${first.toUpperCase()}`))}
                placeholder="New room type..."
                className="min-w-0 flex-1 rounded-xl border border-border bg-background p-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
                maxLength={80}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleAddRoomType()
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleAddRoomType()}
                disabled={!newRoomTypeName.trim() || isUpdatingRoomTypes}
                className="h-auto shrink-0 rounded-xl bg-primary p-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                title="Save Room Type"
              >
                <Check className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => { setIsAddingRoomType(false); setNewRoomTypeName("") }}
                className="h-auto shrink-0 rounded-xl p-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Cancel"
              >
                <X className="size-5" />
              </button>
            </div>
          )}
          {form.formState.errors.roomType?.message ? (
            <p id="roomType-error" className="text-sm font-medium text-destructive" aria-live="polite">
              {form.formState.errors.roomType.message}
            </p>
          ) : null}
          {showLegacyRoomType ? (
            <p className="text-xs text-amber-600">
              "{values.roomType}" is not in your managed room types. You can keep it or select a managed type.
            </p>
          ) : null}
        </div>

        <div className="space-y-1 pt-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">Capacity & Pricing</h3>
          <div className="h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field id="maxGuests" label={<><Users className="mr-1.5 inline size-3.5" />Max Guests</>} required error={form.formState.errors.maxGuests?.message}>
            {(controlProps) => (
              <Input
                {...controlProps}
                ref={maxGuestsInputRef}
                type="number"
                min="1"
                value={values.maxGuests}
                onChange={(event) => updateValue("maxGuests", event.target.value)}
                placeholder="e.g. 2"
              />
            )}
          </Field>
          <Field id="price" label={<><Euro className="mr-1.5 inline size-3.5" />Price / Night</>} required error={form.formState.errors.pricePerNight?.message}>
            {(controlProps) => (
              <Input
                {...controlProps}
                ref={priceInputRef}
                type="number"
                min="0"
                step="0.01"
                value={values.pricePerNight}
                onChange={(event) => updateValue("pricePerNight", event.target.value)}
                placeholder="e.g. 120.00"
              />
            )}
          </Field>
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-1.5"><Bed className="size-3.5" /> Bed Configuration</Label>
          {values.bedConfiguration.map((bed, index) => {
            const bedError = bedErrors?.[index]?.bedType?.message || bedErrors?.[index]?.count?.message
            return (
              <div key={`${bed.bedType}-${index}`} className="space-y-1">
                <div className="flex items-center gap-2">
                  <select
                    ref={(node) => { bedTypeRefs.current[index] = node }}
                    value={bed.bedType}
                    onChange={(event) => updateBedEntry(index, "bedType", event.target.value)}
                    aria-label={`Bed type ${index + 1}`}
                    aria-invalid={bedError ? true : undefined}
                    aria-describedby={bedError ? `bed-${index}-error` : undefined}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {!HOTEL_SERVICE_POINT_BED_TYPES.includes(bed.bedType as typeof HOTEL_SERVICE_POINT_BED_TYPES[number]) ? (
                      <option value={bed.bedType}>{bed.bedType} (current)</option>
                    ) : null}
                    {HOTEL_SERVICE_POINT_BED_TYPES.map((bedType) => (
                      <option
                        key={bedType}
                        value={bedType}
                        disabled={values.bedConfiguration.some((other, otherIndex) => otherIndex !== index && other.bedType === bedType)}
                      >
                        {bedType}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min="1"
                    value={bed.count}
                    aria-label={`Count for ${bed.bedType || `bed ${index + 1}`}`}
                    aria-invalid={bedError ? true : undefined}
                    aria-describedby={bedError ? `bed-${index}-error` : undefined}
                    onChange={(event) => updateBedEntry(index, "count", event.target.value)}
                    className="w-20"
                  />
                  <button
                    type="button"
                    onClick={() => removeBedEntry(index)}
                    aria-label={`Remove ${bed.bedType || `bed ${index + 1}`}`}
                    className="p-1.5 text-muted-foreground transition-colors hover:text-red-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {bedError ? <p id={`bed-${index}-error`} className="text-sm font-medium text-destructive" aria-live="polite">{bedError}</p> : null}
              </div>
            )
          })}
          <button
            type="button"
            onClick={addBedEntry}
            disabled={values.bedConfiguration.length >= HOTEL_SERVICE_POINT_BED_TYPES.length}
            className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            <Plus className="size-3.5" /> Add bed
          </button>
        </div>

        <div className="space-y-1 pt-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">Features</h3>
          <div className="h-px bg-border" />
        </div>
        <Field id="viewType" label={<><Eye className="mr-1.5 inline size-3.5" />View</>}>
          {(controlProps) => (
            <select
              {...controlProps}
              value={values.viewType}
              onChange={(event) => updateValue("viewType", event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">No specific view</option>
              {VIEW_SUGGESTIONS.map((view) => <option key={view} value={view}>{view}</option>)}
            </select>
          )}
        </Field>
        <div className="space-y-3">
          <Label>Amenities</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_AMENITIES.map((amenity) => {
              const isSelected = values.amenities.includes(amenity)
              return (
                <button
                  key={amenity}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggleAmenity(amenity)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {amenity}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1 pt-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">Content</h3>
          <div className="h-px bg-border" />
        </div>
        <div className="space-y-3">
          <Label>Room Images ({values.images.length}/3)</Label>
          <div className="grid grid-cols-2 gap-3">
            {values.images.map((image, index) => (
              <div key={`${image}-${index}`} className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                <img src={image} alt={term.singular} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  aria-label={`Remove image ${index + 1}`}
                  className="absolute right-2 top-2 rounded-md bg-red-500 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}

            {values.images.length < 3 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
                <span className="text-xs font-medium">{isUploading ? "Uploading..." : "Add Image"}</span>
              </button>
            ) : null}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/jpeg, image/png, image/webp"
              className="hidden"
            />
          </div>
          {form.formState.errors.images?.message ? <p className="text-sm font-medium text-destructive">{form.formState.errors.images.message}</p> : null}
        </div>

        <Field id="description" label={<><Info className="mr-1.5 inline size-3.5" />Description</>}>
          {(controlProps) => (
            <Textarea
              {...controlProps}
              value={values.description}
              onChange={(event) => updateValue("description", event.target.value)}
              placeholder="Describe this room, its views, and special features..."
              className="h-24 resize-none"
            />
          )}
        </Field>

        {formNotice ? <FormNotice>{formNotice}</FormNotice> : null}
      </div>
    </ServicePointModalFoundation>
  )
}
