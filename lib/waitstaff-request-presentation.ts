export const MENU_RESOLVED_PRESENTATION_MS = 5_000

export type MenuWaitstaffDisplayState =
  | "idle"
  | "recovering"
  | "pending"
  | "acknowledged"
  | "resolved"
  | "missed"
  | "error"
  | "expired"

export function resolveMenuWaitstaffDisplayState({
  status,
  isRecovering,
  hasError,
  expiredSession,
  resolvedPresentationComplete,
}: {
  status: "pending" | "acknowledged" | "resolved" | "missed" | null
  isRecovering: boolean
  hasError: boolean
  expiredSession: boolean
  resolvedPresentationComplete: boolean
}): MenuWaitstaffDisplayState {
  if (expiredSession) return "expired"
  if (isRecovering) return "recovering"
  if (hasError && !status) return "error"
  if (status === "resolved" && resolvedPresentationComplete) return "idle"
  return status || "idle"
}

export function getMenuWaitstaffCopy(
  state: MenuWaitstaffDisplayState,
  acknowledgedByName?: string | null,
  servicePointLabel?: string | null,
) {
  const staffName = String(acknowledgedByName || "").trim()
  const locationLabel = String(servicePointLabel || "").trim()

  switch (state) {
    case "recovering":
      return {
        title: "Checking service request",
        message: "Please wait a moment.",
        action: null,
      }
    case "pending":
      return {
        title: "Waitstaff requested",
        message: "Someone will be with you shortly.",
        action: null,
      }
    case "acknowledged":
      return {
        title: "Request acknowledged",
        message: staffName
          ? `${staffName} has seen your request.`
          : "A team member has seen your request.",
        action: null,
      }
    case "resolved":
      return {
        title: "Request completed",
        message: "Your request has been handled.",
        action: null,
      }
    case "missed":
      return {
        title: "Request expired",
        message: "We couldn't complete the request in time.",
        action: "Try again",
      }
    case "error":
      return {
        title: "Couldn't send request",
        message: "Please check your connection and try again.",
        action: "Try again",
      }
    case "expired":
      return {
        title: "Session expired",
        message: "Rescan the QR code to request service.",
        action: "Scan QR code",
      }
    default:
      return {
        title: "Request Waitstaff",
        message: locationLabel
          ? `Get assistance at ${locationLabel}.`
          : "Get assistance where you are.",
        action: "Request Waitstaff",
      }
  }
}
