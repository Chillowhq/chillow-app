import { z } from "zod"

export const receiptModalSchema = z.object({
  email: z
    .string()
    .min(1, "Please enter a valid email address.")
    .email("Please enter a valid email address."),
  marketingConsent: z.boolean(),
})

export type ReceiptModalFormValues = z.infer<typeof receiptModalSchema>

export function getReceiptModalDefaultValues(
  defaultEmail: string,
): ReceiptModalFormValues {
  return {
    email: defaultEmail,
    marketingConsent: false,
  }
}

export function toReceiptModalSubmission(values: ReceiptModalFormValues) {
  return {
    email: values.email,
    marketingConsent: values.marketingConsent,
  }
}
