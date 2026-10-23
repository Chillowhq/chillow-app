import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicPageUrl = new URL(
  "./app/reserve/[countryCode]/[businessSlug]/page.tsx",
  import.meta.url,
);
const prefillUrl = new URL("./lib/restaurant-reservation-prefill.ts", import.meta.url);

test("Discovery handoff is an optional restaurant-form prefill, not a booking", async () => {
  const [page, prefill] = await Promise.all([
    readFile(publicPageUrl, "utf8"),
    readFile(prefillUrl, "utf8"),
  ]);

  assert.match(page, /useSearchParams/);
  assert.match(page, /parseRestaurantReservationPrefill\(searchParams/);
  assert.match(page, /getBusinessLocalReservationDate\(business\.timezone \|\| "UTC"\)/);
  assert.match(prefill, /`date`, `startTime`, and `partySize` query/);
  assert.doesNotMatch(prefill, /servicePointId/);
  assert.doesNotMatch(prefill, /payment/);
  assert.doesNotMatch(prefill, /apiClient\.(post|put|patch)/);
});

test("a handed-off time is still gated by canonical current availability", async () => {
  const page = await readFile(publicPageUrl, "utf8");

  assert.match(page, /\/public\/reservations\/restaurant-availability/);
  assert.match(page, /availability\.availableStartTimes\.includes\(preferredStartTime\)/);
  assert.match(page, /The requested time is no longer available/);
  assert.match(page, /\{ \.\.\.current, startTime: "", endTime: "" \}/);
  assert.match(page, /availability\?\.availableStartTimes\.includes\(formData\.startTime\)/);
  assert.match(page, /availability\.validEndTimes\.includes\(formData\.endTime\)/);
});

test("prefill leaves canonical idempotent creation and conflict recovery intact", async () => {
  const page = await readFile(publicPageUrl, "utf8");

  assert.match(page, /reservationAttemptRef/);
  assert.match(page, /"Idempotency-Key"/);
  assert.match(page, /No table is currently available for that time/);
  assert.match(page, /setAvailabilityRefreshVersion/);
  assert.match(page, /setStep\(1\)/);
});
