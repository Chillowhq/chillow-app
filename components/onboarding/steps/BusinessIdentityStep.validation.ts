import { isValidPhoneNumber, parsePhoneNumber } from "react-phone-number-input/max"
import { z } from "zod"

import type { BusinessData } from "@/hooks/use-onboarding"

export const businessIdentitySchema = z.object({
  name: z.string().trim().min(1, "Business name is required"),
  displayName: z.string(),
  businessType: z.string(),
  slug: z
    .string()
    .trim()
    .min(3, "URL slug must be at least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens"),
  contactEmail: z
    .string()
    .trim()
    .min(1, "Contact email is required")
    .email("Enter a valid contact email address"),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .refine(
      (value) => Boolean(parsePhoneNumber(value) && isValidPhoneNumber(value)),
      "Enter a complete, valid phone number",
    ),
})

export type BusinessIdentityFormValues = z.infer<typeof businessIdentitySchema>

export function getBusinessIdentityDefaultValues(
  initial?: Partial<BusinessData>,
  ownerEmail?: string,
): BusinessIdentityFormValues {
  const parsedInitialPhoneNumber = initial?.phoneNumber
    ? parsePhoneNumber(initial.phoneNumber)
    : undefined

  return {
    name: initial?.name ?? "",
    displayName: initial?.displayName ?? "",
    businessType: initial?.businessType ?? "restaurant",
    slug: initial?.slug ?? "",
    contactEmail: initial?.contactEmail ?? ownerEmail ?? "",
    phoneNumber: parsedInitialPhoneNumber?.number ?? "",
  }
}

export function slugifyBusinessName(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
}

export function toBusinessIdentityPayload(
  values: BusinessIdentityFormValues,
): BusinessData {
  const parsedPhoneNumber = parsePhoneNumber(values.phoneNumber)

  if (!parsedPhoneNumber) {
    throw new Error("Enter a complete, valid phone number")
  }

  return {
    name: values.name.trim(),
    displayName: values.displayName.trim() || values.name.trim(),
    businessType: values.businessType,
    slug: values.slug.trim(),
    contactEmail: values.contactEmail.trim(),
    phoneNumber: parsedPhoneNumber.number,
  }
}
