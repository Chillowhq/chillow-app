import { z } from "zod"

export const HOTEL_SERVICE_POINT_BED_TYPES = [
  "Single",
  "Twin",
  "Double",
  "Queen",
  "King",
  "Sofa Bed",
  "Bunk Bed",
] as const

export type HotelServicePointEditFormValues = {
  label: string
  code: string
  roomType: string
  maxGuests: string
  pricePerNight: string
  bedConfiguration: { bedType: string; count: number | "" }[]
  viewType: string
  amenities: string[]
  images: string[]
  description: string
}

export const hotelServicePointEditDefaultValues: HotelServicePointEditFormValues = {
  label: "",
  code: "",
  roomType: "",
  maxGuests: "",
  pricePerNight: "",
  bedConfiguration: [],
  viewType: "",
  amenities: [],
  images: [],
  description: "",
}

export function normalizeHotelServicePointText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function requiredTrimmedString(message: string, maximum: number) {
  return z.string()
    .refine((value) => normalizeHotelServicePointText(value).length > 0, { message })
    .refine((value) => normalizeHotelServicePointText(value).length <= maximum, {
      message: `${message.replace(" is required.", "")} must not exceed ${maximum} characters.`,
    })
}

const bedConfigurationSchema = z.array(z.object({
  bedType: z.string().refine((value) => value.trim().length > 0, {
    message: "Each bed row needs a type and a positive whole-number count.",
  }),
  count: z.union([z.number(), z.literal("")]).refine((value) => (
    typeof value === "number" && Number.isInteger(value) && value >= 1
  ), {
    message: "Each bed row needs a type and a positive whole-number count.",
  }),
})).superRefine((beds, context) => {
  const seenBedTypes = new Set<string>()

  beds.forEach((bed, index) => {
    const key = bed.bedType.trim().toLowerCase()
    if (!key || seenBedTypes.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "bedType"],
        message: "Each bed type can only be added once.",
      })
      return
    }
    seenBedTypes.add(key)
  })
})

export const hotelServicePointEditSchema = z.object({
  label: requiredTrimmedString("Room Name / Label is required.", 80),
  code: requiredTrimmedString("Room Number / Code is required.", 20),
  roomType: z.string().refine((value) => normalizeHotelServicePointText(value).length > 0, {
    message: "Room Type is required.",
  }),
  maxGuests: z.string().refine((value) => {
    const numericValue = Number(value)
    return Number.isInteger(numericValue) && numericValue >= 1
  }, {
    message: "Max Guests must be a positive whole number.",
  }),
  pricePerNight: z.string().refine((value) => {
    const numericValue = Number(value)
    return value.trim().length > 0 && Number.isFinite(numericValue) && numericValue >= 0
  }, {
    message: "Valid Price per Night is required.",
  }),
  bedConfiguration: bedConfigurationSchema,
  viewType: z.string(),
  amenities: z.array(z.string()),
  images: z.array(z.string()).max(3, "Maximum 3 images allowed."),
  description: z.string(),
})
