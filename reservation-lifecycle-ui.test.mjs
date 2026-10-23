import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const actionMapUrl = new URL(
  "./components/reservations/dashboard/hotel-reservation-actions.json",
  import.meta.url,
)
const dashboardUrl = new URL(
  "./components/reservations/HotelReservationsDashboard.tsx",
  import.meta.url,
)
const paymentBadgeUrl = new URL(
  "./components/reservations/dashboard/ReservationPaymentStatusBadge.tsx",
  import.meta.url,
)
const hookUrl = new URL(
  "./components/reservations/dashboard/useReservationDashboard.ts",
  import.meta.url,
)
const cancellationDialogUrl = new URL(
  "./components/reservations/dashboard/HotelReservationCancellationDialog.tsx",
  import.meta.url,
)
const actionsHelperUrl = new URL(
  "./components/reservations/dashboard/hotel-reservation-actions.ts",
  import.meta.url,
)
const transactionsUrl = new URL(
  "./app/owner/transactions/page.tsx",
  import.meta.url,
)

async function readActionMap() {
  return JSON.parse(await readFile(actionMapUrl, "utf8"))
}

test("hotel actions follow the persisted lifecycle instead of arbitrary status choices", async () => {
  const actions = await readActionMap()

  assert.deepEqual(actions.pending, ["accept", "decline", "view"])
  assert.deepEqual(actions.accepted_awaiting_payment, [
    "resend_payment_link",
    "copy_payment_link",
    "cancel",
    "view",
  ])
  assert.deepEqual(actions.confirmed, ["check_in", "cancel", "view"])
  assert.deepEqual(actions.checked_in, ["check_out", "view"])
  assert.deepEqual(actions.checked_out, ["view", "archive"])
})

test("archive is hidden from every non-terminal hotel status", async () => {
  const actions = await readActionMap()

  for (const status of [
    "pending",
    "pending_approval",
    "accepted_awaiting_payment",
    "confirmed",
    "checked_in",
  ]) {
    assert.equal(actions[status].includes("archive"), false, status)
  }

  for (const status of [
    "checked_out",
    "cancelled",
    "expired",
    "declined",
    "completed",
    "no_show",
  ]) {
    assert.equal(actions[status].includes("archive"), true, status)
  }
})

test("the hotel dashboard has no editable row status dropdown", async () => {
  const dashboard = await readFile(dashboardUrl, "utf8")

  assert.equal(dashboard.includes("value={r.status}"), false)
  assert.equal(dashboard.includes("renderStatusSelect"), false)
  assert.equal(dashboard.includes("HotelReservationActionsMenu"), true)
  assert.equal(dashboard.includes("ReservationPaymentStatusBadge"), true)
})

test("reservation and payment status remain independent display inputs", async () => {
  const paymentBadge = await readFile(paymentBadgeUrl, "utf8")

  assert.match(paymentBadge, /paymentStatus/)
  assert.match(paymentBadge, /reservationStatus/)
  assert.match(paymentBadge, /Awaiting Payment/)
  assert.match(paymentBadge, /Paid/)
  assert.match(paymentBadge, /Payment Retained/)
  assert.match(paymentBadge, /Partially Refunded/)
  assert.match(paymentBadge, /Refund Pending/)
})

test("payment expiry refresh uses one deadline timeout and no interval polling", async () => {
  const hook = await readFile(hookUrl, "utf8")

  assert.match(hook, /nextExpiry/)
  assert.match(hook, /window\.setTimeout/)
  assert.doesNotMatch(hook, /setInterval/)
})

test("paid cancellation opens an explicit payment-handling workflow with cents validation", async () => {
  const [dashboard, dialog, actions] = await Promise.all([
    readFile(dashboardUrl, "utf8"),
    readFile(cancellationDialogUrl, "utf8"),
    readFile(actionsHelperUrl, "utf8"),
  ])

  assert.match(dashboard, /HotelReservationCancellationDialog/)
  assert.match(dashboard, /\/owner\/reservations\/\$\{cancellationReservation\._id\}\/cancel/)
  assert.match(dashboard, /Idempotency-Key/)
  assert.doesNotMatch(
    dashboard,
    /updateStatus\(reservation\._id,\s*"cancelled"/,
  )
  assert.match(dialog, /Keep payment — no refund/)
  assert.match(dialog, /Full refund/)
  assert.match(dialog, /Partial refund/)
  assert.match(dialog, /remainingRefundableAmountCents/)
  assert.match(dialog, /refundEconomics/)
  assert.match(dialog, /Customer Paid/)
  assert.match(dialog, /Chillow Fee \(Non-Refundable\)/)
  assert.match(dialog, /Processing Fee \(Non-Refundable\)/)
  assert.match(dialog, /Customer Will Receive/)
  assert.match(dialog, /not deducted from the guest/)
  assert.match(dialog, /Refunds the full eligible amount/)
  assert.match(dialog, /`Refund \$\{formatMoney/)
  assert.match(dialog, /refundAmountCents/)
  assert.match(dialog, /Owner approval required/)
  assert.match(actions, /canRefund/)
  assert.match(actions, /refundPending/)
})

test("owner transactions show refund adjustments without replacing the original charge", async () => {
  const transactions = await readFile(transactionsUrl, "utf8")

  assert.match(transactions, /Original amount paid/)
  assert.match(transactions, /Total refunded/)
  assert.match(transactions, /Net retained/)
  assert.match(transactions, /Refund adjustments/)
  assert.match(transactions, /originalAmountPaidCents/)
  assert.match(transactions, /netRetainedAmountCents/)
})

test("locked hotel check-in codes switch the modal to an authorized resend flow", async () => {
  const dashboard = await readFile(dashboardUrl, "utf8")

  assert.match(dashboard, /CHECK_IN_CODE_LOCKED/)
  assert.match(dashboard, /Check-in code locked/)
  assert.match(dashboard, /Resend new code/)
  assert.match(dashboard, /resend-confirmation/)
  assert.match(dashboard, /checkInCodeLockedAt/)
  assert.match(dashboard, /Ask the guest for the new code/)
  assert.match(dashboard, /canResendCheckInCode/)
})
