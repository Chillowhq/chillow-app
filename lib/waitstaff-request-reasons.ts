export const WAITSTAFF_REQUEST_REASONS = [
  {
    id: "Bill request",
    label: "Request Bill",
    menuLabel: "Bill / payment",
    menuDescription: "I'd like to request the bill.",
    showInMenuSheet: true,
  },
  {
    id: "Customer neeed Assistance",
    label: "Assistance",
    menuLabel: "General assistance",
    menuDescription: "I need a team member at my service point.",
    showInMenuSheet: true,
  },
  {
    id: "Emergency",
    label: "Emergency",
    menuLabel: "Emergency",
    menuDescription: "I need urgent assistance.",
    showInMenuSheet: false,
  },
  {
    id: "Delayed order",
    label: "Delayed order",
    menuLabel: "Delayed order",
    menuDescription: "I need help with a delayed order.",
    showInMenuSheet: false,
  },
  {
    id: "Other reasons",
    label: "Other Reasons",
    menuLabel: "Something else",
    menuDescription: "Other assistance.",
    showInMenuSheet: true,
  },
] as const

export type WaitstaffRequestReason =
  (typeof WAITSTAFF_REQUEST_REASONS)[number]

export type WaitstaffRequestReasonId = WaitstaffRequestReason["id"]

export const DEFAULT_WAITSTAFF_REQUEST_REASON: WaitstaffRequestReasonId =
  "Customer neeed Assistance"

export const MENU_WAITSTAFF_REQUEST_REASONS = [
  WAITSTAFF_REQUEST_REASONS[1],
  WAITSTAFF_REQUEST_REASONS[0],
  WAITSTAFF_REQUEST_REASONS[4],
] as const

export function isWaitstaffRequestReasonId(
  value: string | null | undefined,
): value is WaitstaffRequestReasonId {
  return WAITSTAFF_REQUEST_REASONS.some((reason) => reason.id === value)
}
