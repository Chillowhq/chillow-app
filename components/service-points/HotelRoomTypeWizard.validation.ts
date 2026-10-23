import { z } from "zod"

export type HotelRoomTypeWizardFormValues = {
  name: string
  description: string
  roomSize: string
  roomSizeUnit: "m2" | "ft2"
  maxGuests: string
  viewType: string
  amenities: string[]
}

export const hotelRoomTypeWizardDefaultValues: HotelRoomTypeWizardFormValues = {
  name: "",
  description: "",
  roomSize: "",
  roomSizeUnit: "m2",
  maxGuests: "2",
  viewType: "",
  amenities: [],
}

export function normalizeHotelRoomTypeName(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export const hotelRoomTypeWizardSchema = z.object({
  name: z.string()
    .refine((value) => normalizeHotelRoomTypeName(value).length > 0, {
      message: "Room type name is required.",
    })
    .refine((value) => normalizeHotelRoomTypeName(value).length <= 80, {
      message: "Room type name must not exceed 80 characters.",
    }),
  description: z.string().max(500, "Description must not exceed 500 characters."),
  roomSize: z.string().refine((value) => {
    if (!value) return true
    const numericValue = Number(value)
    return Number.isFinite(numericValue) && numericValue >= 0
  }, {
    message: "Room size must be zero or greater.",
  }),
  roomSizeUnit: z.enum(["m2", "ft2"]),
  maxGuests: z.string().refine((value) => {
    const numericValue = Number(value)
    return Number.isInteger(numericValue) && numericValue >= 1
  }, {
    message: "Maximum guests must be a positive whole number.",
  }),
  viewType: z.string(),
  amenities: z.array(z.string()),
})
