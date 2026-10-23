import actionMap from "./hotel-reservation-actions.json"

export type HotelReservationActionId =
  | "accept"
  | "decline"
  | "resend_payment_link"
  | "copy_payment_link"
  | "cancel"
  | "check_in"
  | "check_out"
  | "view"
  | "archive"

const PAYMENT_LINK_ACTIONS = new Set<HotelReservationActionId>([
  "resend_payment_link",
  "copy_payment_link",
])

export function getHotelReservationActions({
  status,
  paymentUrl,
  paymentStatus,
  canRefund = false,
  refundPending = false,
}: {
  status: string
  paymentUrl?: string | null
  paymentStatus?: string
  canRefund?: boolean
  refundPending?: boolean
}): HotelReservationActionId[] {
  const actions =
    (actionMap as Record<string, HotelReservationActionId[]>)[status] || ["view"]
  const hasCapturedPayment = [
    "paid",
    "partially_refunded",
    "refunded",
  ].includes(paymentStatus || "")

  return actions.filter(
    (action) =>
      (!PAYMENT_LINK_ACTIONS.has(action) || Boolean(paymentUrl)) &&
      (!refundPending || action === "view") &&
      (action !== "cancel" || !hasCapturedPayment || canRefund),
  )
}
