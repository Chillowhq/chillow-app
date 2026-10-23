import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = path => readFile(new URL(path, import.meta.url), "utf8")

test("confirmation page requires the Checkout Session capability from the URL fragment", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /window\.location\.hash/)
  assert.match(source, /\.get\("session_id"\)/)
  assert.match(source, /if \(!confirmationSessionId\)/)
})

test("confirmation page sends capability in a header and never as raw-ID authority", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /"X-Reservation-Confirmation-Session": confirmationSessionId/)
  assert.doesNotMatch(source, /by-id\/\$\{reservationId\}`\);/)
  assert.doesNotMatch(source, /params:\s*\{[^}]*session_id/)
})

test("missing or invalid confirmation capability renders safe unavailable UX", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /setLoadFailed\(true\)/)
  assert.match(source, /Payment Not Confirmed/)
  assert.doesNotMatch(source, /Reservation exists/)
})

test("confirmation success remains gated on canonical reservation payment state", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /reservation\?\.paymentStatus === "paid"/)
  assert.match(source, /confirmed only after payment is verified/)
  assert.doesNotMatch(source, /searchParams.*payment.*success/)
})

test("confirmation capability survives refresh and copied links by remaining in the fragment", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /window\.location\.hash\.replace/)
  assert.doesNotMatch(source, /history\.replaceState|router\.replace/)
})

test("confirmation page renders cancelled, declined, and expired lifecycle states", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /Reservation Cancelled/)
  assert.match(source, /Reservation Declined/)
  assert.match(source, /Reservation Expired/)
})

test("confirmation page renders only masked guest email", async () => {
  const source = await read("./app/reservation/confirmation/[reservationId]/page.tsx")
  assert.match(source, /reservation\?\.maskedEmail/)
  assert.doesNotMatch(source, /reservation\?\.email|reservation\.email/)
  assert.doesNotMatch(source, /reservation\?\.phone|reservation\?\.customerName/)
})

test("Stripe success URL carries the server-issued Session ID in a fragment", async () => {
  const source = await read("../Quickserve-be/src/controllers/paymentController.js")
  assert.match(source, /#session_id=\{CHECKOUT_SESSION_ID\}/)
  assert.doesNotMatch(source, /confirmation\/\$\{reservation\._id\}\?session_id=/)
})

test("payment page still uses its separate secure payment capability", async () => {
  const source = await read("./app/reservation/pay/[secureToken]/page.tsx")
  assert.match(source, /\/public\/reservations\/by-token\/\$\{secureToken\}/)
  assert.match(source, /checkout-reservation", \{ secureToken \}/)
  assert.doesNotMatch(source, /X-Reservation-Confirmation-Session/)
})

test("arrival and not-coming pages retain their separate narrow token endpoints", async () => {
  const [arrival, notComing] = await Promise.all([
    read("./app/reservation/arrival/page.tsx"),
    read("./app/reservation/not-coming/page.tsx"),
  ])
  assert.match(arrival, /\/public\/reservations\/arrival\/validate/)
  assert.match(arrival, /\/public\/reservations\/arrival\/check-in/)
  assert.match(notComing, /\/public\/reservations\/not-coming\/validate/)
  assert.match(notComing, /\/public\/reservations\/not-coming\/cancel/)
  assert.doesNotMatch(`${arrival}\n${notComing}`, /by-id|by-token/)
})
