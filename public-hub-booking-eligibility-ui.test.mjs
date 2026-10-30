import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicHubUrl = new URL(
  "./app/b/[countryCode]/[businessSlug]/page.tsx",
  import.meta.url,
);

test("public hub gates booking on authoritative reservation options", async () => {
  const page = await readFile(publicHubUrl, "utf8");

  assert.match(page, /\/public\/reservation-options\/\$\{countryCode\}\/\$\{businessSlug\}/);
  assert.match(page, /parsePublicReservationModes\(optionsResponse\.data\?\.modes\)/);
  assert.match(page, /const hasPublicReservations = publicReservationModes !== null && publicReservationModes\.length > 0/);
  assert.match(page, /\{hasPublicReservations \? \(/);
  assert.doesNotMatch(page, /reservationsEnabled/);
});

test("public hub preserves mode-less handoff and fails closed on option errors", async () => {
  const page = await readFile(publicHubUrl, "utf8");

  assert.match(page, /router\.push\(`\/reserve\/\$\{countryCode\}\/\$\{businessSlug\}`\)/);
  assert.match(page, /setPublicReservationModes\(\[\]\)/);
  assert.match(page, /setReservationOptionsError\(true\)/);
  assert.match(page, /Booking availability is temporarily unavailable/);
});
