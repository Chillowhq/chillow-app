import { z } from "zod"

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Enter a six-digit hex color, e.g. #EA601A.")

export const brandingFormSchema = z.object({
  enabled: z.boolean(),
  logoUrl: z.string(),
  coverImageUrl: z.string(),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  removeQuickServeBranding: z.boolean(),
})

export type BrandingFormValues = z.infer<typeof brandingFormSchema>

export function getBrandingFormDefaultValues(
  branding?: Partial<BrandingFormValues>,
): BrandingFormValues {
  return {
    enabled: branding?.enabled || false,
    logoUrl: branding?.logoUrl || "",
    coverImageUrl: branding?.coverImageUrl || "",
    primaryColor: branding?.primaryColor || "#EA601A",
    secondaryColor: branding?.secondaryColor || "#2B304C",
    accentColor: branding?.accentColor || "#FB923C",
    backgroundColor: branding?.backgroundColor || "#F8F9FA",
    removeQuickServeBranding: branding?.removeQuickServeBranding || false,
  }
}

export function toBrandingPayload(
  values: BrandingFormValues,
): BrandingFormValues {
  return {
    enabled: values.enabled,
    logoUrl: values.logoUrl,
    coverImageUrl: values.coverImageUrl,
    primaryColor: values.primaryColor,
    secondaryColor: values.secondaryColor,
    accentColor: values.accentColor,
    backgroundColor: values.backgroundColor,
    removeQuickServeBranding: values.removeQuickServeBranding,
  }
}
