/**
 * hotel-room-pricing-display.test.mjs
 *
 * Regression tests for hotel room pricing presentation.
 *
 * CASE A — tax + fee
 *   Room: €128/night. Canonical total (incl. tax + platform fee) ≠ €128.
 *   UI must show the canonical total and "Includes taxes & fees".
 *
 * CASE B — zero tax / zero fee
 *   Room: €128/night, 2 nights. Canonical total €256.
 *   UI must show €256 total but NO "Includes taxes & fees".
 *
 * CASE C — public/staff equivalence
 *   Both flows must source canonical pricing from the same backend field
 *   (pricingSummary) rather than computing it independently.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// ─── File paths ───────────────────────────────────────────────────────────────

const sharedComponentUrl = new URL(
  "./components/reservations/hotel/HotelRoomPriceDisplay.tsx",
  import.meta.url,
);

const publicFlowUrl = new URL(
  "./components/reservations/hotel/HotelReservationFlow.tsx",
  import.meta.url,
);

const staffDialogUrl = new URL(
  "./components/reservations/dashboard/StaffHotelReservationDialog.tsx",
  import.meta.url,
);

const backendControllerUrl = new URL(
  "../Quickserve-be/src/controllers/reservationController.js",
  import.meta.url,
);

// ─── Shared component ─────────────────────────────────────────────────────────

test("HotelRoomPriceDisplay exists and is purely presentational", async () => {
  const src = await readFile(sharedComponentUrl, "utf8");

  // Must not contain any pricing arithmetic
  assert.doesNotMatch(src, /pricePerNight\s*\*\s*nights/, "must not multiply pricePerNight × nights");
  assert.doesNotMatch(src, /taxRate\s*\/\s*100/, "must not apply tax rate");
  assert.doesNotMatch(src, /commissionPercentage/, "must not reference commission");
  assert.doesNotMatch(src, /calculateOnlinePricing/, "must not call pricing engine");

  // Must display the base rate
  assert.match(src, /pricePerNight/, "must render pricePerNight");
  assert.match(src, /\/ night/, "must show nightly rate label");

  // Must display canonical total from pricingSummary
  assert.match(src, /pricingSummary\.total/, "must render canonical total");

  // CASE A: fee label controlled by hasAdditionalCharges
  assert.match(src, /hasAdditionalCharges/, "must conditionally show fee label");
  assert.match(src, /Includes taxes/, "must contain taxes & fees label");

  // CASE B: no hardcoded "Includes taxes" for zero-charge paths
  // The label is conditional — verify it's inside a conditional block
  assert.match(src, /pricingSummary\?\.hasAdditionalCharges\s*&&/, "fee label must be gated by hasAdditionalCharges");
});

// ─── CASE A — tax + fee ───────────────────────────────────────────────────────

test("CASE A: room card displays canonical total and fee disclaimer when charges exist", async () => {
  const publicSrc = await readFile(publicFlowUrl, "utf8");
  const staffSrc = await readFile(staffDialogUrl, "utf8");

  for (const [name, src] of [["public", publicSrc], ["staff", staffSrc]]) {
    // Must import and use HotelRoomPriceDisplay
    assert.match(src, /HotelRoomPriceDisplay/, `${name}: must import HotelRoomPriceDisplay`);
    // Must pass pricingSummary through to the component
    assert.match(src, /pricingSummary={.*pricingSummary}/, `${name}: must pass pricingSummary prop`);
    // Must pass canonical currency — not hardcode €
    assert.match(src, /currency=\{/, `${name}: must pass currency prop`);
  }
});

// ─── CASE B — zero additional charges ─────────────────────────────────────────

test("CASE B: hasAdditionalCharges field is set by backend, never overridden in frontend", async () => {
  const sharedSrc = await readFile(sharedComponentUrl, "utf8");
  const backendSrc = await readFile(backendControllerUrl, "utf8");

  // Backend must compute hasAdditionalCharges
  assert.match(
    backendSrc,
    /hasAdditionalCharges:\s*breakdown\.taxAmountCents\s*>\s*0\s*\|\|\s*breakdown\.customerPlatformFeeCents\s*>\s*0/,
    "backend must set hasAdditionalCharges from canonical cents values",
  );

  // Shared component must not *compute* from taxAmountCents / customerPlatformFeeCents
  // (the interface type definition listing taxAmountCents as a field is acceptable —
  //  we're checking there's no runtime >0 comparison in the component body)
  const componentBody = sharedSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  assert.doesNotMatch(
    componentBody,
    /taxAmountCents\s*>\s*0/,
    "shared component body must not recompute hasAdditionalCharges from taxAmountCents",
  );
  assert.doesNotMatch(
    componentBody,
    /customerPlatformFeeCents\s*>\s*0/,
    "shared component body must not recompute fee flag from customerPlatformFeeCents",
  );
});

// ─── CASE C — public / staff equivalence ──────────────────────────────────────

test("CASE C: both flows use pricingSummary from the same backend structure", async () => {
  const publicSrc = await readFile(publicFlowUrl, "utf8");
  const staffSrc = await readFile(staffDialogUrl, "utf8");
  const backendSrc = await readFile(backendControllerUrl, "utf8");

  // Both endpoints embed pricingSummary
  const publicEndpoint = backendSrc.includes("getAvailableStayServicePoints");
  const staffEndpoint = backendSrc.includes("getHotelRoomAvailability");
  assert.ok(publicEndpoint, "backend must have public availability endpoint");
  assert.ok(staffEndpoint, "backend must have staff availability endpoint");

  // Both embed the same canonical pricingSummary shape
  const occurrences = (src, pattern) => (src.match(new RegExp(pattern, "g")) || []).length;
  assert.ok(
    occurrences(backendSrc, "hasAdditionalCharges") >= 2,
    "backend must embed hasAdditionalCharges in both endpoints",
  );
  assert.ok(
    occurrences(backendSrc, "pricingSummary") >= 2,
    "backend must embed pricingSummary in both endpoints",
  );

  // Both UIs read from pricingSummary — same field name, same source
  assert.match(publicSrc, /servicePoint\.pricingSummary/, "public must read pricingSummary from servicePoint");
  assert.match(staffSrc, /room\.pricingSummary/, "staff must read pricingSummary from room");
});

// ─── No frontend pricing arithmetic ───────────────────────────────────────────

test("room cards do not contain independent pricing arithmetic", async () => {
  const publicSrc = await readFile(publicFlowUrl, "utf8");
  const staffSrc = await readFile(staffDialogUrl, "utf8");

  // The frontend-computed totalPrice variable is gone from the public flow
  assert.doesNotMatch(
    publicSrc,
    /const totalPrice\s*=/,
    "public flow must not have a totalPrice computed variable",
  );

  // Staff room cards must use the shared component, not raw price * nights
  // Verify HotelRoomPriceDisplay is the rendering mechanism for room cards
  assert.match(publicSrc, /HotelRoomPriceDisplay/, "public room cards must use HotelRoomPriceDisplay");
  assert.match(staffSrc, /HotelRoomPriceDisplay/, "staff room cards must use HotelRoomPriceDisplay");

  // Both must pass the canonical pricingSummary prop (not a computed value)
  assert.match(publicSrc, /pricingSummary={servicePoint\.pricingSummary}/, "public must pass servicePoint.pricingSummary");
  assert.match(staffSrc, /pricingSummary={room\.pricingSummary}/, "staff must pass room.pricingSummary");
});

// ─── Backend: both endpoints call the canonical pricing engine ─────────────────

test("backend availability endpoints call calculateOnlinePricing for each room", async () => {
  const backendSrc = await readFile(backendControllerUrl, "utf8");

  assert.match(backendSrc, /calculateOnlinePricing/, "must call calculateOnlinePricing");
  assert.match(backendSrc, /getCustomerPricingBreakdown/, "must call getCustomerPricingBreakdown");

  // Both public and staff sections must embed pricingSummary
  const publicSection = backendSrc.slice(
    backendSrc.indexOf("getAvailableStayServicePoints"),
    backendSrc.indexOf("export async function", backendSrc.indexOf("getAvailableStayServicePoints") + 1),
  );
  assert.match(publicSection, /pricingSummary/, "public endpoint must embed pricingSummary");

  const staffSection = backendSrc.slice(
    backendSrc.indexOf("getHotelRoomAvailability"),
    backendSrc.indexOf("getHotelPricingPreview"),
  );
  assert.match(staffSection, /pricingSummary/, "staff endpoint must embed pricingSummary");
});

// ─── Checkout summary still present ───────────────────────────────────────────

test("payment step still shows detailed breakdown (checkout remains authoritative)", async () => {
  const staffSrc = await readFile(staffDialogUrl, "utf8");
  const publicSrc = await readFile(publicFlowUrl, "utf8");

  // Staff payment step uses HotelPricingBreakdown from backend
  assert.match(staffSrc, /HotelPricingBreakdown/, "staff must still render HotelPricingBreakdown at payment");
  assert.match(staffSrc, /Pricing Summary/, "staff payment step must show Pricing Summary heading");

  // Public confirm step shows price row
  assert.match(publicSrc, /pricingSummary\.total/, "public confirm step must display canonical total");
});
