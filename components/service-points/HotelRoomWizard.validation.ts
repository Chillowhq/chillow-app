import { z } from "zod"

export const hotelRoomWizardSchema = z.object({
  label: z
    .string()
    .refine((value) => Boolean(value.trim()), "Room label is required")
    .refine((value) => value.trim().length <= 80, "Room label must not exceed 80 characters"),
  code: z
    .string()
    .refine((value) => Boolean(value.trim()), "Room number or code is required")
    .refine((value) => value.trim().length <= 20, "Room code must not exceed 20 characters"),
  pricePerNight: z
    .string()
    .refine((value) => Boolean(value) && Number.isFinite(Number(value)) && Number(value) >= 0, "Enter a valid nightly price"),
  maxGuests: z
    .string()
    .refine((value) => !value || (Number.isInteger(Number(value)) && Number(value) >= 1), "Maximum guests must be a positive whole number"),
  isActive: z.boolean(),
  reservable: z.boolean(),
})

export type HotelRoomWizardFormValues = z.infer<typeof hotelRoomWizardSchema>

export function getHotelRoomWizardDefaultValues(initialMaxGuests?: number | null): HotelRoomWizardFormValues {
  return {
    label: "",
    code: "",
    pricePerNight: "",
    maxGuests: initialMaxGuests ? String(initialMaxGuests) : "",
    isActive: true,
    reservable: true,
  }
}

export function hasValidResolvedMaxGuests(value: string, roomTypeMaxGuests?: number | null) {
  const guests = Number(value || roomTypeMaxGuests)
  return Number.isInteger(guests) && guests >= 1
}

