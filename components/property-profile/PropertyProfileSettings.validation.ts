import { z } from "zod"

import type { PropertyProfileResponse } from "@/types/property-profile"

export const propertyProfileContactSchema = z.object({
  phone: z.string().max(40, "Phone must be 40 characters or fewer"),
  email: z
    .string()
    .max(254, "Email must be 254 characters or fewer")
    .refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email address"),
  website: z
    .string()
    .max(2048, "Website must be 2048 characters or fewer")
    .refine((value) => {
      if (!value) return true

      try {
        new URL(value)
        return true
      } catch {
        return false
      }
    }, "Enter a valid website URL"),
  instagram: z.string().max(100, "Instagram handle must be 100 characters or fewer"),
  facebook: z.string().max(255, "Facebook link must be 255 characters or fewer"),
})

export type PropertyProfileContactFormValues = z.infer<typeof propertyProfileContactSchema>

export function getPropertyProfileContactDefaultValues(
  contact?: PropertyProfileResponse["contact"],
): PropertyProfileContactFormValues {
  return {
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    website: contact?.website ?? "",
    instagram: contact?.socialLinks?.instagram ?? "",
    facebook: contact?.socialLinks?.facebook ?? "",
  }
}

export function toPropertyProfileContactPayload(
  values: PropertyProfileContactFormValues,
): PropertyProfileResponse["contact"] {
  return {
    phone: values.phone,
    email: values.email,
    website: values.website,
    socialLinks: {
      instagram: values.instagram,
      facebook: values.facebook,
    },
  }
}
