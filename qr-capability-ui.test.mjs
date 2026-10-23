import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [
  bootstrap,
  qrHelper,
  management,
  qrModal,
  printPage,
  menuPage,
  guestSession,
  customerRoutes,
] =
  await Promise.all([
    readFile(new URL("./app/q/[businessId]/[servicePointId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./lib/qr-capability.ts", import.meta.url), "utf8"),
    readFile(new URL("./app/owner/service-points/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/owner/QrCodeModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/owner/service-points/[id]/print/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/s/[servicePointId]/menu/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./lib/guest-session.ts", import.meta.url), "utf8"),
    readFile(new URL("./lib/customer-routes.ts", import.meta.url), "utf8"),
  ])

test("QR bootstrap captures fragment capability, removes it from the URL, and forwards it only to backend verification", () => {
  assert.match(bootstrap, /readServicePointQrCapability\(window\.location\.hash\)/)
  assert.match(bootstrap, /window\.history\.replaceState/)
  assert.match(bootstrap, /apiClient\.post\("\/table-session\/start", \{[\s\S]*qrCapability,/)
  assert.ok(
    bootstrap.indexOf("window.history.replaceState") <
      bootstrap.indexOf('apiClient.post("/table-session/start"'),
  )
  assert.doesNotMatch(bootstrap, /console\.error\([^\n]*error\)/)
  assert.match(bootstrap, /This QR code is invalid or no longer active/)
})

test("secure QR URLs keep capability in a fragment and normal display URLs omit it", () => {
  assert.match(qrHelper, /#\$\{fragment\}/)
  assert.match(qrHelper, /new URLSearchParams/)
  assert.match(qrHelper, /buildServicePointQrDisplayUrl/)
  assert.doesNotMatch(qrHelper.match(/buildServicePointQrDisplayUrl[\s\S]*$/)?.[0] || "", /fragment/)
})

test("QR generation, bootstrap, menu routing, and GuestSession storage use canonical ServicePoint identity", () => {
  assert.ok(
    qrHelper.includes(
      "return `/q/${encodeURIComponent(businessId)}/${encodeURIComponent(servicePointId)}`",
    ),
  )
  assert.match(bootstrap, /router\.replace\(getTableMenuUrl\(servicePointId, businessId\)\)/)
  assert.ok(
    customerRoutes.includes(
      "return `/s/${servicePointId}/menu?businessId=${encodeURIComponent(businessId)}`",
    ),
  )
  assert.ok(guestSession.includes("`qs_gs_${servicePointId}`"))
  assert.doesNotMatch(`${bootstrap}\n${qrHelper}\n${customerRoutes}\n${guestSession}`, /\/table\//)
  assert.doesNotMatch(guestSession, /qs_st_|tokenKey\s*=\s*\(tableId/)
})

test("QR management fetches current authority, rotates explicitly, and requires manage UI access", () => {
  assert.match(management, /SERVICE_POINTS_MANAGE/)
  assert.match(management, /\/qr-capability`/)
  assert.match(management, /\/qr-capability\/rotate`/)
  assert.match(management, /Previously printed or downloaded codes will stop creating new visits/)
  assert.match(management, /buildServicePointQrUrl/)
  assert.match(management, /setQrCapability\(response\.data\.capability\)/)
})

test("normal QR UI never renders the raw capability as text", () => {
  assert.doesNotMatch(qrModal, /displayUrl \?\? value/)
  assert.match(qrModal, /\{displayUrl\}/)
  assert.doesNotMatch(management, /displayUrl=/)
  assert.doesNotMatch(management, /Public route only/)
  assert.doesNotMatch(printPage, />\s*\{qrUrl\}\s*</)
})

test("ServicePoint QR UI offers an explicit secure copy action without displaying the protected value", () => {
  assert.match(management, /copyValueLabel="Copy QR link"/)
  assert.doesNotMatch(management, /Copy secure QR link/)
  assert.match(qrModal, /navigator\.clipboard\.writeText\(value\)/)
  assert.doesNotMatch(qrModal, />\s*\{value\}\s*</)
})

test("download and print encode secure QR authority for restaurant and hotel ServicePoints", () => {
  assert.match(qrModal, /QRCode\.toDataURL\(value/)
  assert.match(printPage, /requiredPermission: MANAGER_PERMISSIONS\.SERVICE_POINTS_MANAGE/)
  assert.match(printPage, /\/qr-capability/)
  assert.match(printPage, /buildServicePointQrUrl/)
  assert.match(printPage, /qrValue=\{qrUrl\}/)
  assert.match(management, /servicePoint\.servicePointId/)
})

test("public menu, stored GuestSession, refresh, and device history semantics remain separate", () => {
  assert.doesNotMatch(menuPage, /apiClient\.(post|get)\([^\n]*table-session|qrCapability/)
  assert.match(menuPage, /getStoredBusinessId\(\)/)
  assert.match(guestSession, /localStorage\.getItem\(SESSION_KEY\)/)
  assert.match(guestSession, /sessionStorage\.setItem\(tokenKey\(servicePointId\)/)
  assert.match(guestSession, /expiresAt/)
})
