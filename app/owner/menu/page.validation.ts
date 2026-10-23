import { z } from "zod"

function getWordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

export function parseMenuItemPriceInput(value: string) {
  if (!value.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function validateMenuItemPriceInput(value: string) {
  if (!value.trim()) return "Price is required."

  const parsed = parseMenuItemPriceInput(value)
  if (parsed === null || parsed <= 0) return "Enter a valid price greater than 0."

  return null
}

export const menuItemSchema = z.object({
  name: z.string()
    .max(30, "Item name must be 30 characters or less.")
    .refine((value) => value.trim().length > 0, "Item name is required."),
  description: z.string()
    .refine((value) => getWordCount(value) <= 100, "Description must be 100 words or less."),
  price: z.string().superRefine((value, context) => {
    const message = validateMenuItemPriceInput(value)
    if (message) {
      context.addIssue({ code: "custom", message })
    }
  }),
  category: z.string().refine((value) => value.trim().length > 0, "Category is required."),
  prepTimeMinutes: z.string(),
  type: z.enum(["food", "drinks"]),
  fulfillmentStation: z.enum(["kitchen", "bar"]),
  fulfillmentBehavior: z.enum(["prepared", "direct"]),
  isAvailable: z.boolean(),
}).superRefine((values, context) => {
  if (values.fulfillmentBehavior === "direct") return

  const prepTimeMinutes = Number(values.prepTimeMinutes)
  if (!Number.isInteger(prepTimeMinutes) || prepTimeMinutes < 1) {
    context.addIssue({
      code: "custom",
      path: ["prepTimeMinutes"],
      message: "Enter a whole number of at least 1 minute.",
    })
  }
})

export type MenuItemFormValues = z.infer<typeof menuItemSchema>

export function getMenuItemDefaultValues(category = "mains"): MenuItemFormValues {
  return {
    name: "",
    description: "",
    price: "",
    category,
    prepTimeMinutes: "10",
    type: "food",
    fulfillmentStation: "kitchen",
    fulfillmentBehavior: "prepared",
    isAvailable: true,
  }
}

export const menuCategorySchema = z.object({
  category: z.string().refine((value) => value.trim().length > 0, "Category name is required."),
})

export type MenuCategoryFormValues = z.infer<typeof menuCategorySchema>

export function getMenuCategoryDefaultValues(): MenuCategoryFormValues {
  return {
    category: "",
  }
}

export function formatMenuCategoryName(value: string) {
  return value.replace(/^(\s*)(\S)/, (_, spaces: string, first: string) => `${spaces}${first.toUpperCase()}`)
}

export function toMenuCategoryPayload(values: MenuCategoryFormValues) {
  return {
    category: values.category,
  }
}
