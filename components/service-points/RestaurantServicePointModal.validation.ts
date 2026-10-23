import { z } from "zod"

import type {
  ServicePoint,
  ServicePointFormPayload,
} from "@/types/service-point"

const CAPACITY_ERROR = "Capacity must be a valid number of at least 1"

export const restaurantServicePointSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  code: z.string().trim().min(1, "Short Code is required"),
  capacity: z.string().refine((value) => {
    if (!value) return true
    return Number.isFinite(Number(value)) && Number.parseInt(value, 10) >= 1
  }, CAPACITY_ERROR),
})

export type RestaurantServicePointFormValues = z.infer<typeof restaurantServicePointSchema>

export function getRestaurantServicePointDefaultValues(
  initialData: ServicePoint | null,
): RestaurantServicePointFormValues {
  return {
    label: initialData?.label || "",
    code: initialData?.code || "",
    capacity: initialData?.capacity ? String(initialData.capacity) : "",
  }
}

export function formatRestaurantServicePointLabel(value: string) {
  return value.replace(/^(\s*)(\S)/, (_, spaces: string, first: string) => `${spaces}${first.toUpperCase()}`)
}

export function toRestaurantServicePointPayload(
  values: RestaurantServicePointFormValues,
  servicePointType: "table" | "booth" | "other",
): ServicePointFormPayload {
  return {
    label: values.label.trim(),
    code: values.code.trim(),
    capacity: values.capacity ? Number.parseInt(values.capacity, 10) : null,
    servicePointType,
  }
}
