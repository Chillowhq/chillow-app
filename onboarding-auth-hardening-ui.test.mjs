import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8")
}

test("frontend publishes the canonical 12-character and 72-byte policy", async () => {
  const policy = await source("./lib/password-policy.ts")
  assert.match(policy, /PASSWORD_MIN_CHARACTERS = 12/)
  assert.match(policy, /PASSWORD_MAX_UTF8_BYTES = 72/)
  assert.match(policy, /new TextEncoder\(\)/)
})

test("owner signup mirrors the canonical policy and blocks duplicate submission", async () => {
  const page = await source("./components/onboarding/steps/CreateAccountStep.tsx")
  assert.match(page, /validateNewPassword\(password\)/)
  assert.match(page, /PASSWORD_POLICY_MESSAGE/)
  assert.match(page, /if \(isLoading\) return/)
  assert.doesNotMatch(page, /Uppercase letter|Special character|8\+ characters/)
})

test("Owner and Staff invitation setup share the canonical policy", async () => {
  const [owner, staff] = await Promise.all([
    source("./app/setup-account/page.tsx"),
    source("./app/staff/setup-account/page.tsx"),
  ])
  for (const page of [owner, staff]) {
    assert.match(page, /validateNewPassword\(password\)/)
    assert.match(page, /PASSWORD_POLICY_MESSAGE/)
    assert.match(page, /minLength=\{12\}/)
    assert.match(page, /if \(isSubmitting\) return/)
    assert.doesNotMatch(page, /At least 8 characters|minLength=\{8\}/)
  }
})

test("password reset and authenticated password change mirror backend rules", async () => {
  const [reset, settings] = await Promise.all([
    source("./app/reset-password/page.tsx"),
    source("./app/owner/settings/page.tsx"),
  ])
  assert.match(reset, /validateNewPassword\(password\)/)
  assert.match(reset, /if \(isLoading\) return/)
  assert.match(settings, /validateNewPassword\(securityData\.newPassword\)/)
  assert.match(settings, /if \(isUpdatingPassword\) return/)
  assert.match(settings, /reauthenticationRequired/)
})

test("verification UX handles expiry, exhaustion, cooldown, and duplicate requests", async () => {
  const verification = await source("./components/onboarding/steps/VerifyEmailStep.tsx")
  const hook = await source("./hooks/use-onboarding.ts")
  assert.match(hook, /err\.response\?\.data\?\.code/)
  assert.match(verification, /VERIFICATION_CODE_EXPIRED/)
  assert.match(verification, /VERIFICATION_ATTEMPTS_EXHAUSTED/)
  assert.match(verification, /retryAfterSeconds/)
  assert.match(verification, /submitInFlight/)
  assert.match(verification, /resendInFlight/)
  assert.match(verification, /This code can no longer be used/)
})

test("login and public recovery retain safe duplicate-submit and generic-error UX", async () => {
  const login = await source("./app/login/page.tsx")
  assert.match(login, /disabled=\{isLoginLoading\}/)
  assert.match(login, /If an account exists|Reset link sent|check your inbox/i)
  assert.match(login, /Failed to process request\. Please try again\./)
})

