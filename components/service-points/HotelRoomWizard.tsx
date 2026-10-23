"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import {
  BedDouble,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Euro,
  Loader2,
  Plus,
  Sparkles,
  Users,
} from "lucide-react"

import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
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
import { Switch } from "@/components/ui/switch"
import { apiClient } from "@/lib/axios-config"
import type { HotelRoomType } from "@/types/hotel-room-type"
import type { ServicePoint } from "@/types/service-point"
import { HotelRoomTypeWizard } from "./HotelRoomTypeWizard"
import {
  getHotelRoomWizardDefaultValues,
  hasValidResolvedMaxGuests,
  hotelRoomWizardSchema,
  type HotelRoomWizardFormValues,
} from "./HotelRoomWizard.validation"

const STEPS = ["Details", "Settings", "Review"]

function requestKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `room:${crypto.randomUUID()}`
    : `room:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function bedSummary(roomType?: HotelRoomType) {
  const beds = roomType?.bedConfiguration || []
  if (!beds.length) return "Not configured"
  return beds.map((bed) => `${bed.count} ${bed.bedType}`).join(" · ")
}

export function HotelRoomWizard({
  open,
  onOpenChange,
  roomTypes,
  initialRoomTypeName,
  onRoomTypeCreated,
  onCreated,
  onViewRoomTypes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomTypes: HotelRoomType[]
  initialRoomTypeName?: string
  onRoomTypeCreated: (roomType: HotelRoomType) => void
  onCreated: (room: ServicePoint) => void
  onViewRoomTypes: () => void
}) {
  const [step, setStep] = useState(0)
  const [roomTypeName, setRoomTypeName] = useState("")
  const [formError, setFormError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [roomTypeWizardOpen, setRoomTypeWizardOpen] = useState(false)
  const [availableRoomTypes, setAvailableRoomTypes] = useState<HotelRoomType[]>(roomTypes)
  const idempotencyKey = useRef(requestKey())
  const wasOpen = useRef(false)
  const roomTypeTriggerRef = useRef<HTMLButtonElement>(null)
  const submissionInFlight = useRef(false)
  const {
    control,
    clearErrors,
    getValues,
    register,
    reset,
    setError: setFieldError,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<HotelRoomWizardFormValues>({
    resolver: zodResolver(hotelRoomWizardSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getHotelRoomWizardDefaultValues(),
  })
  const label = useWatch({ control, name: "label" })
  const code = useWatch({ control, name: "code" })
  const pricePerNight = useWatch({ control, name: "pricePerNight" })
  const maxGuests = useWatch({ control, name: "maxGuests" })
  const isActive = useWatch({ control, name: "isActive" })
  const reservable = useWatch({ control, name: "reservable" })

  useEffect(() => {
    setAvailableRoomTypes(roomTypes.filter((roomType) => roomType.active !== false))
  }, [roomTypes])

  useEffect(() => {
    if (open && !wasOpen.current) {
      const initialType = roomTypes.find((roomType) => roomType.active !== false && roomType.name === initialRoomTypeName)
      setStep(0)
      reset(getHotelRoomWizardDefaultValues(initialType?.maxGuests))
      setRoomTypeName(initialType?.name || "")
      setFormError("")
      setRoomTypeWizardOpen(false)
      idempotencyKey.current = requestKey()
    }
    wasOpen.current = open
  }, [initialRoomTypeName, open, reset, roomTypes])

  const selectedRoomType = useMemo(
    () => availableRoomTypes.find((roomType) => roomType.name === roomTypeName),
    [availableRoomTypes, roomTypeName],
  )

  function selectRoomType(value: string) {
    const selected = availableRoomTypes.find((roomType) => roomType.name === value)
    setRoomTypeName(value)
    if (!getValues("maxGuests") && selected?.maxGuests) {
      setValue("maxGuests", String(selected.maxGuests))
      clearErrors("maxGuests")
    }
    setFormError("")
  }

  async function validateStep(currentStep: number) {
    setFormError("")

    if (currentStep === 0) {
      const detailsValid = await trigger(["label", "code"], { shouldFocus: true })
      if (!detailsValid) return false
      if (!roomTypeName) {
        setFormError("Select a Room Type before continuing.")
        roomTypeTriggerRef.current?.focus()
        return false
      }
    }

    if (currentStep === 1) {
      const settingsValid = await trigger(["pricePerNight", "maxGuests"], { shouldFocus: true })
      if (!settingsValid) return false
      if (!hasValidResolvedMaxGuests(getValues("maxGuests"), selectedRoomType?.maxGuests)) {
        setFieldError("maxGuests", {
          type: "validate",
          message: "Maximum guests must be a positive whole number",
        }, { shouldFocus: true })
        return false
      }
    }

    return true
  }

  async function next() {
    if (!await validateStep(step)) return
    setStep((current) => Math.min(STEPS.length - 1, current + 1))
  }

  async function createRoom() {
    if (isSaving || submissionInFlight.current) return
    if (!await validateStep(0) || !await validateStep(1)) return

    submissionInFlight.current = true
    setIsSaving(true)
    setFormError("")

    try {
      const { label, code, pricePerNight, maxGuests, isActive, reservable } = getValues()
      const response = await apiClient.post<ServicePoint>(
        "/owner/service-points",
        {
          label: label.trim(),
          code: code.trim(),
          servicePointType: "room",
          roomType: roomTypeName,
          pricePerNight: Number(pricePerNight),
          maxGuests: Number(maxGuests || selectedRoomType?.maxGuests),
          isActive,
          reservable,
        },
        { headers: { "Idempotency-Key": idempotencyKey.current } },
      )
      onCreated(response.data)
      onOpenChange(false)
    } catch (saveError: any) {
      setFormError(saveError.response?.data?.error || "Room could not be created. Please try again.")
    } finally {
      submissionInFlight.current = false
      setIsSaving(false)
    }
  }

  function acceptCreatedRoomType(roomType: HotelRoomType) {
    setAvailableRoomTypes((current) => [...current.filter((item) => item.name !== roomType.name), roomType].sort((left, right) => left.sortOrder - right.sortOrder))
    setRoomTypeName(roomType.name)
    if (roomType.maxGuests) setValue("maxGuests", String(roomType.maxGuests))
    onRoomTypeCreated(roomType)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
        <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[88dvh]">
          <DialogHeader className="border-b border-border px-5 py-5 pr-12 sm:px-6">
            <DialogTitle>Add Room</DialogTitle>
            <DialogDescription>Create an individual hotel room using the canonical ServicePoint architecture.</DialogDescription>
            <ol className="mt-4 grid grid-cols-3" aria-label="Room creation progress">
              {STEPS.map((item, index) => (
                <li key={item} className="relative flex flex-col items-center gap-1">
                  {index > 0 ? <span className="absolute right-1/2 top-3.5 h-px w-full bg-border" /> : null}
                  <span className={`relative z-10 flex size-7 items-center justify-center rounded-full border text-xs font-black ${index <= step ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}>{index + 1}</span>
                  <span className={`text-[10px] font-bold ${index === step ? "text-primary" : "text-muted-foreground"}`}>{item}</span>
                </li>
              ))}
            </ol>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6" aria-busy={isSaving}>
            {step === 0 ? (
              <div className="space-y-5">
                <div><h3 className="text-lg font-black">Room details</h3><p className="text-sm text-muted-foreground">Labels may be numbers or names such as Garden Suite or Villa Azure.</p></div>
                <Field id="new-room-label" label="Room label" required error={errors.label?.message}>
                  {(controlProps) => (
                    <Input
                      {...register("label", { onChange: () => setFormError("") })}
                      {...controlProps}
                      autoFocus
                      maxLength={80}
                      placeholder="e.g. Room 401, Garden Suite, Villa Azure"
                      required
                    />
                  )}
                </Field>
                <div className="space-y-2">
                  <Field id="new-room-code" label="Room number / code" required error={errors.code?.message}>
                    {(controlProps) => (
                      <Input
                        {...register("code", { onChange: () => setFormError("") })}
                        {...controlProps}
                        maxLength={20}
                        placeholder="e.g. 401 or VILLA-A"
                        required
                      />
                    )}
                  </Field>
                  <p className="text-xs text-muted-foreground">Used for short operational references; the room label remains the guest-facing name.</p>
                </div>
                <div className="space-y-2"><Label>Room type *</Label><Select value={roomTypeName} onValueChange={selectRoomType}><SelectTrigger ref={roomTypeTriggerRef} aria-label="Select Room Type"><SelectValue placeholder="Select a room type" /></SelectTrigger><SelectContent>{availableRoomTypes.map((roomType) => <SelectItem key={roomType.name} value={roomType.name}>{roomType.name}</SelectItem>)}</SelectContent></Select>{!availableRoomTypes.length ? <p className="text-sm text-amber-700">Create a Room Type before adding a room.</p> : null}</div>
                <Button type="button" variant="outline" className="w-full justify-start border-dashed" onClick={() => setRoomTypeWizardOpen(true)}><Plus /> Create new room type</Button>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-6">
                <div><h3 className="text-lg font-black">Room settings</h3><p className="text-sm text-muted-foreground">Individual operational states stay separate from the Room Type template.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Field id="new-room-price" label={<span className="flex items-center gap-2"><Euro className="size-4" /> Nightly price</span>} required error={errors.pricePerNight?.message}>
                      {(controlProps) => (
                        <Input
                          {...register("pricePerNight")}
                          {...controlProps}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g. 120.00"
                          required
                        />
                      )}
                    </Field>
                    <p className="text-xs text-muted-foreground">Uses the existing room pricing field.</p>
                  </div>
                  <div className="space-y-2">
                    <Field id="new-room-guests" label={<span className="flex items-center gap-2"><Users className="size-4" /> Maximum guests</span>} required error={errors.maxGuests?.message}>
                      {(controlProps) => (
                        <Input
                          {...register("maxGuests")}
                          {...controlProps}
                          type="number"
                          min="1"
                          placeholder={selectedRoomType?.maxGuests ? String(selectedRoomType.maxGuests) : "Required"}
                        />
                      )}
                    </Field>
                    <p className="text-xs text-muted-foreground">Defaults from the Room Type and can be overridden here.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4"><div><p className="font-bold">Active</p><p className="text-sm text-muted-foreground">Available for service and guest interaction.</p></div><Switch checked={isActive} onCheckedChange={(value) => setValue("isActive", value, { shouldDirty: true })} aria-label="Room active" /></div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4"><div><p className="font-bold">Reservations enabled</p><p className="text-sm text-muted-foreground">Include this room in canonical hotel availability.</p></div><Switch checked={reservable} onCheckedChange={(value) => setValue("reservable", value, { shouldDirty: true })} aria-label="Room reservations enabled" /></div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div><h3 className="text-lg font-black">Review room</h3><p className="text-sm text-muted-foreground">Verify the room before creation. The backend remains authoritative.</p></div>
                <section className="overflow-hidden rounded-2xl border border-border">
                  {selectedRoomType?.images?.[0] ? <img src={selectedRoomType.images[0]} alt="" className="h-44 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-muted text-muted-foreground"><DoorOpen className="size-10" /></div>}
                  <div className="space-y-4 p-4">
                    <div><p className="text-xl font-black">{label.trim()}</p><p className="text-sm font-semibold text-primary">{roomTypeName}</p><p className="text-xs text-muted-foreground">Code {code.trim()}</p></div>
                    <dl className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">Guests</dt><dd className="mt-1 flex items-center gap-2 font-bold"><Users className="size-4" />Up to {maxGuests || selectedRoomType?.maxGuests}</dd></div><div className="rounded-xl bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">Beds</dt><dd className="mt-1 flex items-center gap-2 font-bold"><BedDouble className="size-4" />{bedSummary(selectedRoomType)}</dd></div><div className="rounded-xl bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">Price</dt><dd className="mt-1 font-bold">€{Number(pricePerNight || 0).toFixed(2)} / night</dd></div><div className="rounded-xl bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">Availability</dt><dd className="mt-1 flex items-center gap-2 font-bold"><Calendar className="size-4" />{reservable ? "Reservations On" : "Reservations Off"}</dd></div></dl>
                    <div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isActive ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{isActive ? "Active" : "Inactive"}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${reservable ? "bg-sky-500/10 text-sky-700" : "bg-muted text-muted-foreground"}`}>{reservable ? "Reservations On" : "Reservations Off"}</span></div>
                  </div>
                </section>
              </div>
            ) : null}

            {formError ? <FormNotice className="mt-5">{formError}</FormNotice> : null}
          </div>

          <DialogFooter className="flex-row items-center justify-between border-t border-border px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => step === 0 ? onOpenChange(false) : setStep((current) => current - 1)}><ChevronLeft />{step === 0 ? "Cancel" : "Back"}</Button>
            <Button type="button" disabled={isSaving || (step === 0 && !availableRoomTypes.length)} onClick={() => step === STEPS.length - 1 ? void createRoom() : void next()}>{isSaving ? <Loader2 className="animate-spin" /> : step === STEPS.length - 1 ? <Sparkles /> : null}{step === STEPS.length - 1 ? "Create Room" : "Continue"}{step < STEPS.length - 1 ? <ChevronRight /> : null}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HotelRoomTypeWizard
        open={roomTypeWizardOpen}
        onOpenChange={setRoomTypeWizardOpen}
        onCreated={acceptCreatedRoomType}
        onAddRoomNow={() => setRoomTypeWizardOpen(false)}
        onViewRoomTypes={() => {
          setRoomTypeWizardOpen(false)
          onOpenChange(false)
          onViewRoomTypes()
        }}
      />
    </>
  )
}
