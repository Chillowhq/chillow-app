import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [axiosSource, authContextSource, settingsSource] = await Promise.all([
  readFile(new URL("./lib/axios-config.ts", import.meta.url), "utf8"),
  readFile(new URL("./contexts/AuthContext.tsx", import.meta.url), "utf8"),
  readFile(new URL("./app/owner/settings/page.tsx", import.meta.url), "utf8"),
])

test("canonical API client converts backend Staff revocation into one UI auth event", () => {
  assert.match(axiosSource, /SESSION_REVOKED_EVENT = "qs:session-revoked"/)
  assert.match(axiosSource, /error\?\.response\?\.status === 401/)
  assert.match(axiosSource, /error\?\.response\?\.data\?\.code === "SESSION_REVOKED"/)
  assert.match(axiosSource, /window\.dispatchEvent\(new Event\(SESSION_REVOKED_EVENT\)\)/)
})

test("AuthContext clears stale dashboard state and returns revoked Staff to login", () => {
  assert.match(authContextSource, /window\.addEventListener\(SESSION_REVOKED_EVENT, handleSessionRevoked\)/)
  assert.match(authContextSource, /setUser\(null\)/)
  assert.match(authContextSource, /router\.replace\("\/login"\)/)
  assert.match(authContextSource, /window\.removeEventListener\(SESSION_REVOKED_EVENT, handleSessionRevoked\)/)
})

test("Staff password change reacts immediately to required reauthentication", () => {
  assert.match(settingsSource, /response\.data\?\.reauthenticationRequired/)
  assert.match(settingsSource, /window\.dispatchEvent\(new Event\(SESSION_REVOKED_EVENT\)\)/)
})
