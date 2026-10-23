import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [frontendOrigin, nextConfig, settingsPage, servicePointsPage, printPage] = await Promise.all([
  readFile(new URL("./lib/frontend-origin.ts", import.meta.url), "utf8"),
  readFile(new URL("./next.config.mjs", import.meta.url), "utf8"),
  readFile(new URL("./app/owner/settings/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("./app/owner/service-points/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("./app/owner/service-points/[id]/print/page.tsx", import.meta.url), "utf8"),
])

test("generated frontend links use the canonical configured origin", () => {
  assert.match(nextConfig, /FRONTEND_BASE_URL is required for production builds/)
  assert.match(nextConfig, /NEXT_PUBLIC_FRONTEND_BASE_URL/)
  assert.match(frontendOrigin, /process\.env\.NEXT_PUBLIC_FRONTEND_BASE_URL/)
  assert.match(frontendOrigin, /typeof window !== "undefined"/)

  for (const source of [settingsPage, servicePointsPage, printPage]) {
    assert.match(source, /getCanonicalFrontendOrigin/)
    assert.doesNotMatch(source, /window\.location\.origin/)
  }

  assert.match(settingsPage, /new URL\(frontendOrigin\)\.host/)
  assert.match(servicePointsPage, /buildServicePointQrUrl\(\s*origin,/)
  assert.match(printPage, /buildServicePointQrUrl\(\s*getCanonicalFrontendOrigin\(\)/)
})
